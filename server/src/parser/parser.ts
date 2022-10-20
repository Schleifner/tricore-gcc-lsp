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

const ps = new Parser();
const insn: tricore_insn_t = {
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

// ps.tricore_ip("st.w [%a14]-4,%d15", insn);          // @4i   find_opcode -> @wd + 5
// ps.tricore_ip("ld.w %d15,[%sp]4", insn);            // i&3   find_opcode -> i&k + 29
// ps.tricore_ip("movh %d15,16457", insn);             // iq    find_opcode -> dW + 14
// ps.tricore_ip("addi %d15,%d15,-2621", insn);        // iiw   find_opcode -> ddw + 14
// ps.tricore_ip("movh %d15,hi:.LC0", insn);           // iU    find_opcode -> dW + 14
// ps.tricore_ip("lea %a4,[%a15]lo:.LC0", insn);       // ASU   find_opcode -> a@w + 5

// ps.tricore_ip("ld.w %d4,3026", insn);               // dq    find_opcode -> dt + 0     ABS
// ps.tricore_ip("ld.w %d5,hi:.LC0", insn);            // dU    find_opcode -> dt + 0     ABS

// ps.tricore_ip("st.t 0x90000000,7,1", insn);         // t31   find_opcode -> t31 + 1    ABSB

// ps.tricore_ip("call foobar", insn)                  // U     find_opcode -> R + 25     SB
// ps.tricore_ip("call 0x900000", insn)                // 8     find_opcode -> O + 2      B

// ps.tricore_ip("xnor.t %d3,%d1,3,%d2,5", insn)       // dd2d3 find_opcode -> dd5d5 + 3  BIT

// ps.tricore_ip("ld.w %d4,[%a14+]-4", insn);          // d>4   find_opcode -> d>0 + 4    BO
// ps.tricore_ip("ld.w %d4,[+%a14]-4", insn);          // d<4   find_opcode -> d<0 + 4    BO
// ps.tricore_ip("ld.w %d4,[%a4+r]", insn);            // d#    find_opcode -> d# + 4     BO
// ps.tricore_ip("ld.w %d4,[%a4+c],16", insn);         // d*v   find_opcode -> d*0 + 4    BO

// ps.tricore_ip("ld.w %d4,[%a14]-4", insn);           // d@4   find_opcode -> d@w + 5    BOL

// ps.tricore_ip("jeq %d5,6,foobar", insn);            // d3U   find_opcode -> d4o + 6    BRC

// ps.tricore_ip("jnz.t %d1,13,2156", insn);           // dfq   find_opcode -> d5o + 7    BRN

// ps.tricore_ip("jeq %d1,%d2,foobar", insn);          // ddU   find_opcode -> ddo + 8    BRR

// ps.tricore_ip("add %d3,%d1,126", insn);             // dd8   find_opcode -> dd9 + 9    RC

// ps.tricore_ip("imask %e2,6,5,11", insn);            // D33f  find_opcode -> Df55 + 10  RCPW

// ps.tricore_ip("madd %d0,%d1,%d2,7", insn);          // ddd3  find_opcode -> ddd9 + 11  RCR
// ps.tricore_ip("madd %e0,%e0,%d3,80", insn);         // DDd8  find_opcode -> DDd9 + 11  RCR

// ps.tricore_ip("insert %d3,%d1,6,%e4", insn);        // dd3D  find_opcode -> ddfD + 12  RCRR

// ps.tricore_ip("insert %d3,%d1,0,%d4,8", insn);      // dd1df find_opcode -> ddfd5 + 13 RCRW

// ps.tricore_ip("addi %d3,%d1,-14526", insn);         // ddo   find_opcode -> ddw + 14   RLC

// ps.tricore_ip("abs %d3,%d1", insn);                 // dd    find_opcode -> dd + 15    RR

// ps.tricore_ip("mul.h %e0,%d3,%d4ll,1", insn);       // Dd-1  find_opcode -> Dd-1 + 16  RR1
// ps.tricore_ip("mul.h %e0,%d3,%d4lu,1", insn);       // Ddl1  find_opcode -> Ddl1 + 16  RR1
// ps.tricore_ip("mul.h %e0,%d3,%d4ul,1", insn);       // DdL1  find_opcode -> DdL1 + 16  RR1
// ps.tricore_ip("mul.h %e0,%d3,%d4uu,1", insn);       // Dd+1  find_opcode -> Dd+1 + 16  RR1

// ps.tricore_ip("mul %d3,%d1,%d2", insn);             // ddd   find_opcode -> ddd + 17   RR2
// ps.tricore_ip("mul %e2,%d5,%d1", insn);             // Ddd   find_opcode -> Ddd + 17   RR2

// ps.tricore_ip("imask %e2,%d1,5,11", insn);          // Dd3f  find_opcode -> Dd55 + 18  RRPW

// ps.tricore_ip("add.f %d3,%d1,%d2", insn);           // ddd   find_opcode -> ddd + 19   RRR
// ps.tricore_ip("cadd %d3,%d4,%d1,%d2", insn);        // dddd  find_opcode -> dddd + 19  RRR

// ps.tricore_ip("madd.h %e0,%e2,%d4,%d5ll,1", insn);  // DDd-1 find_opcode -> DDd-1 + 20 RRR1
// ps.tricore_ip("madd.h %e0,%e2,%d4,%d5lu,1", insn);  // DDdl1 find_opcode -> DDdl1 + 20 RRR1
// ps.tricore_ip("madd.h %e0,%e2,%d4,%d5ul,1", insn);  // DDdL1 find_opcode -> DDdL1 + 20 RRR1
// ps.tricore_ip("madd.h %e0,%e2,%d4,%d5uu,1", insn);  // DDd+1 find_opcode -> DDd+1 + 20 RRR1

// ps.tricore_ip("madd %d0,%d1,%d2,%d3", insn);        // dddd  find_opcode -> dddd + 21  RRR2
// ps.tricore_ip("madd %e0,%e2,%d6,%d11", insn);       // DDdd  find_opcode -> DDdd + 21  RRR2

// ps.tricore_ip("insert %d3,%d1,%d2,%e4", insn);      // dddD  find_opcode -> dddD + 22  RRRR

// ps.tricore_ip("insert %d3,%d1,%d2,%d4,8", insn);    // ddddf find_opcode -> dddd5 + 23 RRRW

// ps.tricore_ip("debug", insn);                       // ''    find_opcode -> '' + 32    SYS
// ps.tricore_ip("disable %d3", insn);                 // d     find_opcode -> d + 24     SYS

// ps.tricore_ip("jeq %d15,6,12", insn);               // i3f   find_opcode -> i4m + 26   SBC
// ps.tricore_ip("jeq %d15,6,foobar", insn);           // i3U   find_opcode -> i4x + 26   SBC

// ps.tricore_ip("jeq %d15,%d2,12", insn);             // idf   find_opcode -> idm + 27   SBR
// ps.tricore_ip("jeq %d15,%d2,foobar", insn);         // idU   find_opcode -> idx + 27   SBR

// ps.tricore_ip("jz.t %d15,1,foobar", insn);          // i1U   find_opcode -> ifm + 28   SBRN

// ps.tricore_ip("mov %d15,126", insn);                // i8    find_opcode -> i8 + 29    SC

// ps.tricore_ip("ld.a %a4,[%a5]", insn);              // A@    find_opcode -> a@ + 30    SLR
// ps.tricore_ip("ld.a %a4,[%a5+]", insn);             // A>    find_opcode -> a> + 30    SLR

// ps.tricore_ip("ld.a %a4,[%a15]+4", insn);           // AS3   find_opcode -> aS6 + 31   SLRO

// ps.tricore_ip("ji %a2", insn);                      // A     find_opcode -> a + 32     SR

// ps.tricore_ip("add %d2,4", insn);                   // d3    find_opcode -> d4 + 33    SRC
// ps.tricore_ip("add %d2,%d15,4", insn);              // di3   find_opcode -> di4 + 33   SRC 
// ps.tricore_ip("add %d15,%d2,4", insn);              // id3   find_opcode -> id4 + 33   SRC

// ps.tricore_ip("ld.a %a15,[%a12]+4", insn);          // I@3   find_opcode -> I@6 + 34   SRO

// ps.tricore_ip("add %d0,%d1", insn);                 // dd    find_opcode -> dd + 35    SRR
// ps.tricore_ip("add %d0,%d15,%d1", insn);            // did   find_opcode -> did + 35   SRR
// ps.tricore_ip("add %d15,%d0,%d1", insn);            // idd   find_opcode -> idd + 35   SRR

// ps.tricore_ip("addsc.a %a0,%a1,%d15,1", insn);      // Aai1  find_opcode -> aai2 + 36  SRRS

// ps.tricore_ip("st.a [%a1],%a0", insn);              // @A    find_opcode -> @a + 37    SSR
// ps.tricore_ip("st.a [%a1+],%a0", insn);             // >A    find_opcode -> >a + 37    SSR

// ps.tricore_ip("st.a [%a15]+4,%a1", insn);           // S3a   find_opcode -> S6a + 38   SSRO

console.log(insn);
console.log(ps.find_opcode(insn));