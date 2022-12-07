import { 
  pfxs, 
  MAX_OPS, 
  PREFIX_T, 
  TRICORE_INSN_T, 
  TRICORE_OPCODE, 
  operandMatrix, 
  opcodeHash, 
} from "./instruction";

import {
  DIRECTIVE_T, 
  directiveHash, 
} from "./directive";

import {
  CharCode,
  isDecimal,
  isNameBeginner,
  isPartOfName,
  isWhiteSpace,
} from "./util";

export interface ParserDiagnostic {
  line: number,
  message: string;
}

export default class Parser {
  private symbolTable = new Set<string>();
  private undefinedSymbols: [number, string][] = [];
  private externalSymbols = new Set<string>();
  private diagnosticInfos: ParserDiagnostic[] = [];
  private document: string;
  private lineCounter: number;
  private pos: number;

  constructor(input: string) {
    this.document = preprocess(input);
    this.lineCounter = 0;
    this.pos = 0;
  }

  private read_regno(str: string): { regno: number; offset: number; error?: string } {
    let regno = 0, digits_seen = 0;
    
    while (isDecimal(str.charCodeAt(digits_seen))) {
      regno = regno * 10 + (str.charCodeAt(digits_seen) - CharCode._0);
      ++digits_seen;
      if ((regno > 15) || (digits_seen > 2)) {
        return { regno: -1, offset: digits_seen, error: "invalid register number" };
      }
    }
    if (!digits_seen) {
      return { regno: -1, offset: digits_seen, error: "missing register number" };
    }
    return { regno, offset: digits_seen };
  }

  private read_regsuffix(str: string): { regsuffix: string, offset: number } {
    let chars_seen= 0;
    if (str.charCodeAt(chars_seen) === CharCode.l) {
      return (str.charCodeAt(chars_seen + 1) === CharCode.l) ? { regsuffix: "-", offset: 2 }
        : (str.charCodeAt(chars_seen + 1) === CharCode.u) ? { regsuffix: "l", offset: 2 }
        : { regsuffix: "g", offset: 1};
    } else if (str.charCodeAt(chars_seen) === CharCode.u) {
      return (str.charCodeAt(chars_seen + 1) === CharCode.l) ? { regsuffix: "L", offset: 2 }
        : (str.charCodeAt(chars_seen + 1) === CharCode.u) ? { regsuffix: "+", offset: 2 }
        : { regsuffix: "G", offset: 1};
    }
    return { regsuffix: "d", offset: 0 };
  }

  private classify_numeric(num: number): string {
    if (num < 0) {
      if (num >= -8) {
        return "4";
      }
      if (num >= -16) {
        return "F";
      }
      if ((num >= -32) && !(num & 1)) {
        return "r";
      }
      if (num >= -256) {
        return (num & 1) ? "9" : "R";
      }
      if (num >= -512) {
        return "0";
      }
      if (num >= -32768) {
        return (num & 1) ? "w" : "o";
      }
      if ((num >= -16777216) && !(num & 1)) {
        return 'O';
      }
    } else {
      if (num < 2) {
        return "1";
      }
      if (num < 4) {
        return "2";
      }
      if (num < 8) {
        return "3";
      }
      if (num < 16) {
        return "f";
      }
      if (num < 31) {
        return (num & 1) ? "5" : "v";
      }
      if (num < 32) {
        return "5";
      }
      if ((num < 61) && !(num & 3)) {
        return "6";
      }
      if ((num < 63) && !(num & 1)) {
        return 'x';
      }
      if (num < 256) {
        return "8";
      }
      if (num < 512) {
        return "n";
      }
      if ((num < 1024) && !(num & 3)) {
        return "k";
      }
      if (num < 1024) {
        return "h";
      }
      if (num < 32768) {
        return "q";
      }
      if (num < 65536) {
        return "W";
      }
      if ((num < 16777215) && !(num & 1)) {
        return "O";
      }
    }

    if (!(num & 0x0fffc000)) {
      return "t";
    } else if (!(num & 0x0fe00001)) {
      return "T";
    }
    if (!(num & 0x00003fff)) {
      return "V";
    }

    return "M";
  }

  private get_expression(the_insn: TRICORE_INSN_T, src: string, str: string, opnr: number) {
    let bitposFlag = false, prefix: PREFIX_T = PREFIX_T.PREFIX_NONE;
    let colonIndex = str.indexOf(":");
    if (colonIndex !== -1) {
      
      for (const pfx of pfxs) {
        if (pfx.pfx === str.slice(0, colonIndex + 1)) {
  
          if (pfx.pcod === PREFIX_T.PREFIX_BITPOS) {
            bitposFlag = true;
          } else {
            prefix = pfx.pcod;
            if (pfx.pcod !== PREFIX_T.PREFIX_SBREG) {
              the_insn.needs_prefix = opnr;
            }
          }
  
          break;
        }
      }
    }

    str = str.slice(++colonIndex);
    if (src.slice(src.toLowerCase().indexOf(str) + 1).indexOf("_GLOBAL_OFFSET_TABLE_") != -1) {
      switch (prefix) {
        case PREFIX_T.PREFIX_NONE:
          prefix = PREFIX_T.PREFIX_GOTPC;
          break;
        case PREFIX_T.PREFIX_HI:
          prefix = PREFIX_T.PREFIX_GOTPCHI;
          break;
        case PREFIX_T.PREFIX_LO:
          prefix = PREFIX_T.PREFIX_GOTPCLO;
          break;
        case PREFIX_T.PREFIX_UP:
          prefix = PREFIX_T.PREFIX_GOTPCUP;
          break;
        case PREFIX_T.PREFIX_GOTPC:
        case PREFIX_T.PREFIX_GOTPCHI:
        case PREFIX_T.PREFIX_GOTPCLO:
        case PREFIX_T.PREFIX_GOTPCUP:
          break;

        default:
          the_insn.error = "illegal prefix for GOT expression";
          return 0;
      }
    }

    let numeric: number | undefined;
    if (str.match(/^[+-]?\d+(\.\d+)?([Ee][+-]?\d+)?$/)
      || str.match(/^0[Bb][01]+$/)
      || str.match(/^0[Xx][0-9a-fA-F]+$/)) {
      numeric = Number(str);
      if (!Number.isInteger(numeric)) {
        the_insn.error = "bad numeric constant";
        return 0;
      }
    } else if (str.match(/^[a-zA-Z_][0-9a-zA-Z_]*$/)) {
      the_insn.label.push(str);
    } else if (str.match(/(1?[0-9]{1,2}|2[0-4][0-9]|25[0-5])[pnbf]/)) {
      the_insn.label.push(str.slice(0, -1));
    } else {
      // more complex expression, TO DO
    }

    if (numeric || numeric == 0) {
      switch (prefix) {
        case PREFIX_T.PREFIX_NONE:
        case PREFIX_T.PREFIX_HI:
        case PREFIX_T.PREFIX_LO:
        case PREFIX_T.PREFIX_UP:
          break;
        default:
          the_insn.error = "illegal prefix for constant expression";
          return 0;
      }
      if (bitposFlag && (numeric < 0 || numeric > 7)) {
        the_insn.error = "illegal constant bit position";
        return 0;
      }
      the_insn.ops[opnr] = this.classify_numeric(numeric);
      the_insn.is_odd[opnr] = (numeric & 1);
      if (prefix != PREFIX_T.PREFIX_NONE) {
        the_insn.ops[opnr] = "q"; /* Matches both "w" and "W"! */
      } else if (the_insn.ops[opnr] === "k") {
        the_insn.matches_k[opnr] = 1;
      } else if (the_insn.ops[opnr] === "6") {
        the_insn.matches_6[opnr] = 1;
        the_insn.matches_k[opnr] = 1;
      } else if ("123fmxv".indexOf(the_insn.ops[opnr]) >= 0) {
        if (!(numeric & 1)) {
          the_insn.matches_v[opnr] = 1;
        }
        if (!(numeric & 3)) {
          the_insn.matches_6[opnr] = 1;
          the_insn.matches_k[opnr] = 1;
        }
      } else if ("58n".indexOf(the_insn.ops[opnr]) >= 0) {
        if (!(numeric & 3)) {
          the_insn.matches_k[opnr] = 1;
        }
      }
    } else {
      the_insn.ops[opnr] = "U";
      the_insn.matches_v[opnr] = 1;
      the_insn.matches_6[opnr] = 1;
      the_insn.matches_k[opnr] = 1;
    }

    return true;
  }

  tricore_ip(str: string, the_insn: TRICORE_INSN_T) {
    let numops = -1, mode = 0;
    const insnline = str.toLowerCase();
    const tokens = insnline.split(/\s|,/);

    let opcode: TRICORE_OPCODE[] | undefined;
    if ((opcode = opcodeHash.get(tokens[0])) === undefined) {
      the_insn.error = "unknown instruction";
      return;
    }
    the_insn.name = opcode[0].name;
    
    let tokenIndex = 2;
    while(tokenIndex <= tokens.length) {
      const dst = tokens[tokenIndex - 1];
      if (++numops === MAX_OPS) {
        the_insn.error = "too many operands";
        return;
      }
      let preinc = 0, dstIndex = 0, regno = -1;
      switch (dst.charCodeAt(dstIndex)) {
        case CharCode.Percent:
          mode = dst.charCodeAt(++dstIndex);
          if ((mode === CharCode.s) && (dst.charCodeAt(dstIndex + 1) === CharCode.p) && (dstIndex + 2 === dst.length)) {
            the_insn.ops[numops] = "P";
            break;
          }
          if ((mode !== CharCode.d) && (mode !==  CharCode.e) && (mode !== CharCode.a)) {
            the_insn.error = "invalid register specification";
            return;
          }

          dstIndex++;
          const regInfo = this.read_regno(dst.slice(dstIndex));
          let { offset, error } = regInfo;
          regno = regInfo.regno;
          if (error) {
            the_insn.error = error;
            return;
          }
          dstIndex += offset;

          if ((mode === CharCode.d) && (dst.charCodeAt(dstIndex) === CharCode.Plus) && (dstIndex + 1 === dst.length)) {
            mode = CharCode.e;
            ++dstIndex;
          }

          if ((mode === CharCode.d) && (dstIndex < dst.length)) {
            let { regsuffix, offset } = this.read_regsuffix(dst.slice(dstIndex));
            mode = regsuffix.charCodeAt(0);
            the_insn.ops[numops] = regsuffix;
            dstIndex += offset;
          }

          if (dstIndex < dst.length) {
            the_insn.error = "trailing chars after register specification";
            return;
          }
          if (mode === CharCode.d) {
            the_insn.ops[numops] = (regno === 15) ? "i" : "d"; 
          } else if (mode === CharCode.e) {
            if (regno & 1) {
              the_insn.error = "invalid extended register specification";
              return;
            }
            the_insn.ops[numops] = "D";
          } else if (mode === CharCode.a) {
            the_insn.ops[numops] = (regno === 10) ? "P"
              : (regno === 15) ? "I"
              : (regno & 1) ? "a"
              : "A";
          }
          break;
        case CharCode.OpenBracket:
          if (dstIndex + 1 >= dst.length) {
            the_insn.error = "missing address register";
            return;
          }
          if (dst.charCodeAt(++dstIndex) === CharCode.Plus) {
            ++dstIndex;
            preinc = 1;
          }
          if (dst.charCodeAt(dstIndex++) !== CharCode.Percent) {
            the_insn.error = "missing address register";
            return;
          }
          if ((dst.charCodeAt(dstIndex) === CharCode.s) && dst.charCodeAt(dstIndex + 1) === CharCode.p) {
            regno = 10;
            dstIndex += 2;
          } else if (dst.charCodeAt(dstIndex) === CharCode.a) {
            ++dstIndex;
            const regInfo = this.read_regno(dst.slice(dstIndex));
            let { offset, error } = regInfo;
            regno = regInfo.regno;
            if (error) {
              the_insn.error = error;
              return;
            }
            dstIndex += offset;
          } else {
            the_insn.error = "invalid or missing address register";
            return;
          }

          if (dstIndex >= dst.length) {
            the_insn.error = "missing ']'";
            return;
          } else if (dst.charCodeAt(dstIndex) === CharCode.CloseBracket) {
            if (preinc) {
              the_insn.ops[numops] = "<";
            } else {
              the_insn.ops[numops] = (regno === 15) ? "S"
                : (regno === 10) ? "&"
                : "@";
            }
            if (++dstIndex < dst.length) {
              if (!this.get_expression(the_insn, str, dst.slice(dstIndex), ++numops)) {
                return;
              }
              break;
            } else {
              break;
            }
          } else if (dst.charCodeAt(dstIndex) === CharCode.Plus) {
            if (preinc) {
              the_insn.error = "invalid address mode";
              return;
            }
            if (++dstIndex >= dst.length) {
              the_insn.error = "missing ']'";
              return;
            }
            if (dst.charCodeAt(dstIndex) === CharCode.CloseBracket) {
              the_insn.ops[numops] = ">";
              if (++dstIndex < dst.length) {
                if (!this.get_expression(the_insn, str, dst.slice(dstIndex), ++numops)) {
                  return;
                }
                break;
              } else {
                break;
              }
            }
            mode = dst.charCodeAt(dstIndex);
            if ((mode === CharCode.c) || (mode === CharCode.r) || (mode === CharCode.i)) {
              if (regno & 1) {
                the_insn.error = "even address register required";
                return;
              }
              if (dst.charCodeAt(++dstIndex) != CharCode.CloseBracket) {
                the_insn.error = "missing ']'";
                return;
              }
              if (mode === CharCode.c) {
                the_insn.ops[numops] = "*";
                if (++dstIndex < dst.length) {
                  if (!this.get_expression(the_insn, str, dst.slice(dstIndex), ++numops)) {
                    return;
                  }
                  break;
                }
              } else {
                the_insn.ops[numops] = (mode === CharCode.r) ? "#" : "?";
                if (++dstIndex < dst.length) {
                  the_insn.error = "no offset allowed for this mode";
                  return;
                }
              }
              break;
            } else {
              the_insn.error = "invalid address mode";
              return;
            }
          } else {
            the_insn.error = "invalid address mode";
            return;
          }
        default:
          if (!this.get_expression(the_insn, str, dst, numops)) {
            return;
          }
          break;
      }
      tokenIndex ++;
    }

    the_insn.nops = ++numops;
  }

  find_opcode(the_insn: TRICORE_INSN_T) {
    const ops = opcodeHash.get(the_insn.name);
    if (!ops) {
      return undefined;
    }
    for (const op of ops) {
      if (op.nr_operands !== the_insn.nops || (!op.len32 && the_insn.needs_prefix)) continue;
      
      let index: number;
      for (index = 0; index < the_insn.nops; ++index) {
        if (operandMatrix.get(op.args.charAt(index))!.indexOf(the_insn.ops[index]) === -1
          || (op.args.charCodeAt(index) === CharCode.v && !the_insn.matches_v[index])
          || (op.args.charCodeAt(index) === CharCode._6 && !the_insn.matches_6[index])
          || (op.args.charCodeAt(index) === CharCode.k && !the_insn.matches_k[index])
        ) break;
        if (!op.len32 && the_insn.ops[index] === "U" && "mxrRoO".indexOf(op.args.charAt(index)) === -1) break;
      }

      if (index === the_insn.nops) {
        return op;
      }
    }

    return undefined;
  }

  private md_assemble(oneLineAsm: string): string | undefined {
    const the_insn: TRICORE_INSN_T = {
      error: "",
      name: "",
      nops: 0,
      label: [],
      ops: [],
      matches_v: [],
      matches_6: [],
      matches_k: [],
      is_odd: [],
      needs_prefix: 0
    };
    this.tricore_ip(oneLineAsm, the_insn);
    if (the_insn.error) {
      return the_insn.error;
    }
    if (this.find_opcode(the_insn) === undefined) {
      return "opcode/operand mismatch: " + oneLineAsm;
    }

    for (let index = 0; index < the_insn.nops; ++index) {
      if ("mxrRoO".indexOf(the_insn.ops[index]) >= 0 && the_insn.is_odd[index]) {
        return "displacement is not even;";
      }
    }

    if (the_insn.label.length > 0) {
      the_insn.label.forEach(item => {
        if (!this.symbolTable.has(item)) {
          this.undefinedSymbols.push([this.lineCounter, item]);
        }
      });
    }

    return;
  }

  parse_a_document() {
    const text = this.document;
    this.lineCounter = 0;
    this.pos = 0;
    let c = 0, s = "";
    while (this.pos < text.length) {
      do {
        c = text.charCodeAt(this.pos++);
      } while (isWhiteSpace(c));

      if (isNameBeginner(c)) {
        let startPos = this.pos - 1;
        while (isPartOfName(c = text.charCodeAt(this.pos))) { this.pos ++; }
        s = text.slice(startPos, this.pos);

        if (c === CharCode.Colon) {
          this.symbolTable.add(s);
          this.pos ++;
          while (isWhiteSpace(text.charCodeAt(this.pos))) { this.pos ++; }
        } else if (text.charCodeAt(startPos) === CharCode.Dot) {
          if (c === CharCode.Space) {
            this.pos++;
          }
          let directiveType = directiveHash.get(s.slice(1));
          switch (directiveType) {
            case DIRECTIVE_T.IGNORE:
              this.ignoreRestOfLine();
              break;
            case DIRECTIVE_T.SINGLE_SYMBOL:
              this.getSingleSymbol();
              break;
            case DIRECTIVE_T.MULTI_SYMBOL:
              this.getMultiSymbol();
              break;
            case DIRECTIVE_T.EXTERN_SYMBOL:
              this.getExternSymbol();
              break;
            default:
              this.diagnosticInfos.push({
                line: this.lineCounter,
                message: "unknown pseudo-op"
              });
              break;
          }
        } else {
          while (text.charCodeAt(this.pos++) !== CharCode.LineFeed) {}
          s = text.slice(startPos, this.pos - 1);
          const result = this.md_assemble(s);
          if (result) {
            this.diagnosticInfos.push({ line: this.lineCounter, message: result });
          }
          this.lineCounter ++;
        }
        continue;
      }

      if (c === CharCode.LineFeed) {
        this.lineCounter ++;
        continue;
      }
      
      if (isDecimal(c)) {
        let startPos = this.pos - 1;
        while (isDecimal(text.charCodeAt(this.pos))) { this.pos ++; }
        if (text.charCodeAt(this.pos) === CharCode.Colon) {
          this.symbolTable.add(text.slice(startPos, this.pos));
          this.pos ++;
          continue;
        } else if (text.charCodeAt(this.pos) === CharCode.Dollar && text.charCodeAt(this.pos + 1) === CharCode.Colon) {
          this.symbolTable.add(text.slice(startPos, this.pos));
          this.pos += 2;
          continue;
        }
        this.pos = startPos + 1;
      }

      this.pos --;
      this.diagnosticInfos.push({ line: this.lineCounter, message: `junk at end of line, first unrecognize character is '${text.charAt(this.pos)}'` });
      this.ignoreRestOfLine();
    }
    this.undefinedSymbols.forEach( ([line, symbol]) => {
      if (!this.externalSymbols.has(symbol)) {
        this.diagnosticInfos.push({ line, message: "unknown symbol" });
      }
    });
    return this.diagnosticInfos;
  }

  getSingleSymbol() {
    let s = this.getSymbol();
    this.symbolTable.add(s);
    this.ignoreRestOfLine();
  }

  getExternSymbol() {
    let s = this.getSymbol();
    this.externalSymbols.add(s);
    this.ignoreRestOfLine();
  }

  getMultiSymbol() {
    let c;
    do {
      this.symbolTable.add(this.getSymbol());
      c = this.document.charCodeAt(this.pos);
      if (c === CharCode.Comma) {
        this.pos ++;
      }
    } while(c === CharCode.Comma);
    this.ignoreRestOfLine();
  }

  ignoreRestOfLine() {
    while (this.pos < this.document.length && this.document.charCodeAt(this.pos++) !== CharCode.LineFeed) {}
    this.lineCounter ++;
  }

  getSymbol() {
    let startPos = this.pos;
    while (isPartOfName(this.document.charCodeAt(this.pos))) { this.pos ++; }
    if (startPos === this.pos) {
      this.diagnosticInfos.push({ line: this.lineCounter, message: "expected symbol name" });
    }
    return this.document.slice(startPos, this.pos);
  }

}

function preprocess(str: string): string {
  let pos = 0, out = "", state = 0, end = str.length;

  while (pos < end) {
    let c = str.charCodeAt(pos);
    switch (c) {
      case CharCode.Space:
      case CharCode.Tab: {
        while (++pos < end && isWhiteSpace(str.charCodeAt(pos))) {}
        if (state === 0 || state === 2) {
          out += " ";
          state += 1;
        } 
        break;
      }
      case CharCode.DoubleQuote: {
        let start = pos;
        while (++start < end && !(str.charCodeAt(start) === CharCode.DoubleQuote && str.charCodeAt(start - 1) !== CharCode.BackSlash)) {}
        // Unterminated string
        out += str.slice(pos, start + 1);
        pos = start + 1;
        break;
      }
      case CharCode.SingleQuote: {
        let start = pos;
        while (++start < end && !(str.charCodeAt(start) === CharCode.SingleQuote && str.charCodeAt(start - 1) !== CharCode.BackSlash)) {}
        // Unterminated string
        out += str.slice(pos, start + 1);
        pos = start + 1;
        break;
      }
      case CharCode.Hash: {
        while (++pos < end && str.charCodeAt(pos) !== CharCode.LineFeed) {}
        break;
      }
      case CharCode.Slash: {
        if (++pos >= end) {
          out += String.fromCharCode(c);
          return out;
        }
        
        let ch = str.charCodeAt(pos);
        if (ch === CharCode.Slash) {
          while (++pos < end && str.charCodeAt(pos) !== CharCode.LineFeed) {}
          break;
        }
        if (ch === CharCode.Asterisk) {
          while (++pos < end) {
            let chr = str.charCodeAt(pos);
            if (chr === CharCode.LineFeed) { out += "\n"; }
            if (
              chr === CharCode.Asterisk &&
              pos + 1 < end &&
              str.charCodeAt(pos + 1) === CharCode.Slash
            ) {
              pos += 2;
              break;
            }
          }
          break;
        }
        out += String.fromCharCode(c);
        break;
      }
      case CharCode.CarriageReturn: {
        if (str.charCodeAt(pos + 1) === CharCode.LineFeed) {
          out += String.fromCharCode(CharCode.LineFeed);
          state = 0;
          pos += 2;
          break;
        }
        out += String.fromCharCode(c);
        ++pos;
        break;
      }
      case CharCode.LineFeed: {
        out += String.fromCharCode(c);
        state = 0;
        ++pos;
        break;
      }
      default: {
        ++pos;
        out += String.fromCharCode(c);
        if (state === 0 || state === 1) {
          state = 2;
        }
        break;
      }
    }
  }

  return out;
}

import * as fs from "fs";
import * as path from "path";

const asm = fs.readFileSync(path.resolve("../tricoreboot/asm_demo.S"), "utf-8");
const ps = new Parser(asm);
console.log(ps.parse_a_document());