import { 
  pfxs, 
  MAX_OPS, 
  prefix_t, 
  tricore_insn_t, 
  tricore_opcode, 
  tricore_opcodes, 
  operand_compatibility_matrix 
} from "./tricore";

export default class Parser {
  private hash_ops = new Map<string, tricore_opcode[]>();
  private operand_matrix = new Map<string, string>();

  constructor() {
    this.md_begin();
  }

  private md_begin() {
    tricore_opcodes.forEach(opcode => {
      if (this.hash_ops.has(opcode.name)) {
        const opcodeList = this.hash_ops.get(opcode.name);
        opcodeList!.push(opcode);
      } else {
        this.hash_ops.set(opcode.name, [opcode]);
      }
    });
    operand_compatibility_matrix.forEach(pair => {
      const { key, value } = pair;
      this.operand_matrix.set(key, value);
    });
  }

  private read_regno(str: string): { regno: number; offset: number; error?: string } {
    let regno = 0, digits_seen = 0;
    
    while ((str.charCodeAt(digits_seen) >= 48) && (str.charCodeAt(digits_seen) <= 57)) {
      regno = regno * 10 + (str.charCodeAt(digits_seen) - 48);
      ++digits_seen;
      if ((regno > 15) || (digits_seen > 2)) {
        return { regno: -1, offset: digits_seen, error: "Invalid register number" };
      }
    }
    if (!digits_seen) {
      return { regno: -1, offset: digits_seen, error: "Missing register number" };
    }
    return { regno, offset: digits_seen };
  }

  private read_regsuffix(str: string): { regsuffix: string, offset: number } {
    let chars_seen= 0;
    if (str.charAt(chars_seen) === "l") {
      return (str.charAt(chars_seen + 1) === "l") ? { regsuffix: "-", offset: 2 }
        : (str.charAt(chars_seen + 1) === "u") ? { regsuffix: "l", offset: 2 }
        : { regsuffix: "g", offset: 1};
    } else if (str.charAt(chars_seen) === "u") {
      return (str.charAt(chars_seen + 1) === "l") ? { regsuffix: "L", offset: 2 }
        : (str.charAt(chars_seen + 1) === "u") ? { regsuffix: "+", offset: 2 }
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

  private get_expression(the_insn: tricore_insn_t, src: string, str: string, opnr: number) {
    let bitposFlag = false, prefix: prefix_t = prefix_t.PREFIX_NONE;
    let colonIndex = str.indexOf(":");
    if (colonIndex !== -1) {
      
      for (const pfx of pfxs) {
        if (pfx.pfx === str.slice(0, colonIndex + 1)) {
  
          if (pfx.pcod === prefix_t.PREFIX_BITPOS) {
            bitposFlag = true;
          } else {
            prefix = pfx.pcod;
            if (pfx.pcod !== prefix_t.PREFIX_SBREG) {
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
        case prefix_t.PREFIX_NONE:
          prefix = prefix_t.PREFIX_GOTPC;
          break;
        case prefix_t.PREFIX_HI:
          prefix = prefix_t.PREFIX_GOTPCHI;
          break;
        case prefix_t.PREFIX_LO:
          prefix = prefix_t.PREFIX_GOTPCLO;
          break;
        case prefix_t.PREFIX_UP:
          prefix = prefix_t.PREFIX_GOTPCUP;
          break;
        case prefix_t.PREFIX_GOTPC:
        case prefix_t.PREFIX_GOTPCHI:
        case prefix_t.PREFIX_GOTPCLO:
        case prefix_t.PREFIX_GOTPCUP:
          break;

        default:
          // TO FIX: use as_bad() to print error rather than the_insn.error;
          the_insn.error = "Illegal prefix for GOT expression";
          break;
      }
    }

    let numeric: number | undefined;
    if (str.match(/^[+-]?\d+(\.\d+)?([Ee][+-]?\d+)?$/)
      || str.match(/^0[Bb][01]+$/)
      || str.match(/^0[Xx][0-9a-fA-F]+$/)) {
      numeric = Number(str);
      if (!numeric) {
        // TO FIX: use as_bad() to print error rather than the_insn.error; 
        the_insn.error = "bad numeric constant";
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
        case prefix_t.PREFIX_NONE:
        case prefix_t.PREFIX_HI:
        case prefix_t.PREFIX_LO:
        case prefix_t.PREFIX_UP:
          break;
        default:
          the_insn.error = "Illegal prefix for constant expression";
          return 0;
      }
      if (bitposFlag && (numeric < 0 || numeric > 7)) {
        the_insn.error = "Illegal constant bit position";
        return 0;
      }
      the_insn.ops[opnr] = this.classify_numeric(numeric);
      the_insn.is_odd[opnr] = (numeric & 1);
      if (prefix != prefix_t.PREFIX_NONE) {
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

  tricore_ip(str: string, the_insn: tricore_insn_t) {
    let numops = -1, mode = "";
    const insnline = str.toLowerCase();
    const tokens = insnline.split(/\s|,/);

    let opcode: tricore_opcode[] | undefined;
    if ((opcode = this.hash_ops.get(tokens[0])) === undefined) {
      the_insn.error = "Unknown instruction";
      return;
    }
    the_insn.name = opcode[0].name;
    
    let tokenIndex = 2;
    while(tokenIndex <= tokens.length) {
      const dst = tokens[tokenIndex - 1];
      if (++numops === MAX_OPS) {
        the_insn.error = "Too many operands";
        return;
      }
      let preinc = 0, dstIndex = 0, regno = -1;
      switch (dst[dstIndex]) {
        case "%":
          mode = dst[++dstIndex];
          if ((mode === "s") && (dst[dstIndex + 1] === "p") && (dstIndex + 2 === dst.length)) {
            the_insn.ops[numops] = "P";
            break;
          }
          if ((mode != "d") && (mode != "e") && (mode != "a")) {
            the_insn.error = "Invalid register specification";
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

          if ((mode === "d") && (dst[dstIndex] === "+") && (dstIndex + 1 === dst.length)) {
            mode = "e";
            ++dstIndex;
          }

          if ((mode === "d") && (dstIndex < dst.length)) {
            let { regsuffix, offset } = this.read_regsuffix(dst.slice(dstIndex));
            mode = regsuffix;
            the_insn.ops[numops] = regsuffix;
            dstIndex += offset;
          }

          if (dstIndex < dst.length) {
            the_insn.error = "Trailing chars after register specification";
            return;
          }
          if (mode === "d") {
            the_insn.ops[numops] = (regno === 15) ? "i" : "d"; 
          } else if (mode === "e") {
            if (regno & 1) {
              the_insn.error = "Invalid extended register specification";
              return;
            }
            the_insn.ops[numops] = "D";
          } else if (mode === "a") {
            the_insn.ops[numops] = (regno === 10) ? "P"
              : (regno === 15) ? "I"
              : (regno & 1) ? "a"
              : "A";
          }
          break;
        case "[":
          switch(dst[++dstIndex]) {
            case undefined:
              the_insn.error = "Missing address register";
              return;
            case "+":
              ++dstIndex;
              preinc = 1;
              break;
          }
          if (dst[dstIndex++] != "%") {
            the_insn.error = "Missing address register";
            return;
          }
          if ((dst[dstIndex] === "s") && dst[dstIndex + 1] === "p") {
            regno = 10;
            dstIndex += 2;
          } else if (dst[dstIndex] === "a") {
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
            the_insn.error = "Invalid or missing address register";
            return;
          }

          if (dst[dstIndex] === undefined) {
            the_insn.error = "Missing ']'";
            return;
          } else if (dst[dstIndex] === "]") {
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
          } else if (dst[dstIndex] === "+") {
            if (preinc) {
              the_insn.error = "Invalid address mode";
              return;
            }
            if (++dstIndex >= dst.length) {
              the_insn.error = "Missing ']'";
              return;
            }
            if (dst[dstIndex] === "]") {
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
            mode = dst[dstIndex];
            if ((mode === "c") || (mode === "r") || (mode === "i")) {
              if (regno & 1) {
                the_insn.error = "Even address register required";
                return;
              }
              if (dst[++dstIndex] != "]") {
                the_insn.error = "Missing ']'";
                return;
              }
              if (mode === "c") {
                the_insn.ops[numops] = "*";
                if (++dstIndex < dst.length) {
                  if (!this.get_expression(the_insn, str, dst.slice(dstIndex), ++numops)) {
                    return;
                  }
                  break;
                }
              } else {
                the_insn.ops[numops] = (mode === "r") ? "#" : "?";
                if (++dstIndex < dst.length) {
                  the_insn.error = "No offset allowed for this mode";
                  return;
                }
              }
              break;
            } else {
              the_insn.error = "Invalid address mode";
              return;
            }
          } else {
            the_insn.error = "Invalid address mode";
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

  find_opcode(the_insn: tricore_insn_t) {
    const ops = this.hash_ops.get(the_insn.name);
    if (!ops) {
      return undefined;
    }
    for (const op of ops) {
      if (op.nr_operands !== the_insn.nops || (!op.len32 && the_insn.needs_prefix)) continue;
      
      let index: number;
      for (index = 0; index < the_insn.nops; ++index) {
        if (this.operand_matrix.get(op.args.charAt(index))!.indexOf(the_insn.ops[index]) === -1
          || (op.args.charAt(index) === "v" && !the_insn.matches_v[index])
          || (op.args.charAt(index) === "6" && !the_insn.matches_6[index])
          || (op.args.charAt(index) === "k" && !the_insn.matches_k[index])
        ) break;
        if (!op.len32 && the_insn.ops[index] === "U" && "mxrRoO".indexOf(op.args.charAt(index)) === -1) break;
      }

      if (index === the_insn.nops) {
        return op;
      }
    }

    return undefined;
  }

  private md_assemble(str: string, the_insn: tricore_insn_t) {
    this.tricore_ip(str, the_insn);
    if (this.find_opcode(the_insn) === undefined) {

    }

    for (let index = 0; index < the_insn.nops; ++index) {
      if ("mxrRoO".indexOf(the_insn.ops[index]) >= 0 && the_insn.is_odd[index]) {
        // as_bad("Displacement is not even");
      }
    }
  }

}