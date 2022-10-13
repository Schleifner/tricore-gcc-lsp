import { tricore_opcodes, tricore_opcode, tricore_insn_t, MAX_OPS, pfxs, prefix_t } from "./tricore";

export default class Parser {
  private hash_ops = new Map<string, tricore_opcode[]>();

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
            if (pfx.pcod === prefix_t.PREFIX_SBREG) {
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

    let numeric = 0;
    if (str.match(/^[+-]?[\d]+([\.][\d]+)?([Ee][+-]?[\d]+)?$/)) {
      numeric = Number(str);
      if (!numeric) {
        // TO FIX: use as_bad() to print error rather than the_insn.error; 
        the_insn.error = "bad scientific expressions constant";
      }
    }
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
            console.log(the_insn.error);
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
              //TODO getExpression or goto restart_scan;
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
                //TODO getExpression or goto restart_scan;
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
                  //TODO getExpression or goto restart_scan;
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
          // if (!this.get_expression()) {
          //   return;
          // }
          break;
      }
      tokenIndex ++;
    }

    the_insn.nops = ++numops;
  }

  private md_assemble(str: string) {

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
  needs_prefix: 0
}
ps.tricore_ip("movh %d15,hi:.LC0", insn);
console.log(insn);