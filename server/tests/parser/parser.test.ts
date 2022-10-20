import Parser from '../../src/parser/parser'
import { tricore_insn_t } from '../../src/parser/tricore';
 
type insFormatTestDatas = {
	insn: string;
	name: string;
	operands: string;
	format: number;
}[];

const testDatas: insFormatTestDatas = [
	{ insn: "ld.w %d4,3026", 							name: "ld.w", 		operands: "dt", 		format: 0 	},
	{ insn: "ld.w %d5,hi:.LC0", 					name: "ld.w", 		operands: "dt", 		format: 0 	},
	{ insn: "st.t 0x90000000,7,1", 				name: "st.t", 		operands: "t31", 		format: 1 	},
	{ insn: "call foobar", 								name: "call", 		operands: "R", 			format: 25 	},
	{ insn: "call 0x900000", 							name: "call", 		operands: "O", 			format: 2 	},
	{ insn: "xnor.t %d3,%d1,3,%d2,5", 		name: "xnor.t", 	operands: "dd5d5",  format: 3 	},
	{ insn: "ld.w %d4,[%a14+]-4", 				name: "ld.w", 		operands: "d>0", 		format: 4 	},
	{ insn: "ld.w %d4,[+%a14]-4", 				name: "ld.w", 		operands: "d<0", 		format: 4 	},
	{ insn: "ld.w %d4,[%a4+r]", 					name: "ld.w", 		operands: "d#", 		format: 4 	},
	{ insn: "ld.w %d4,[%a4+c],16", 				name: "ld.w", 		operands: "d*0", 		format: 4 	},
	{ insn: "ld.w %d4,[%a14]-4", 					name: "ld.w", 		operands: "d@w", 		format: 5 	},
	{ insn: "jeq %d5,6,foobar", 					name: "jeq", 			operands: "d4o", 		format: 6 	},
	{ insn: "jnz.t %d1,13,2156", 					name: "jnz.t", 		operands: "d5o", 		format: 7 	},
	{ insn: "jeq %d1,%d2,foobar", 				name: "jeq", 			operands: "ddo", 		format: 8 	},
	{ insn: "add %d3,%d1,126", 						name: "add", 			operands: "dd9", 		format: 9 	},
	{ insn: "imask %e2,6,5,11", 					name: "imask", 		operands: "Df55", 	format: 10 	},
	{ insn: "madd %d0,%d1,%d2,7", 				name: "madd", 		operands: "ddd9", 	format: 11 	},
	{ insn: "madd %e0,%e0,%d3,80", 				name: "madd", 		operands: "DDd9", 	format: 11 	},
	{ insn: "insert %d3,%d1,6,%e4", 			name: "insert", 	operands: "ddfD", 	format: 12 	},
	{ insn: "insert %d3,%d1,0,%d4,8", 		name: "insert", 	operands: "ddfd5", 	format: 13 	},
	{ insn: "addi %d3,%d1,-14526", 				name: "addi", 		operands: "ddw", 		format: 14 	},
	{ insn: "abs %d3,%d1", 								name: "abs", 			operands: "dd", 		format: 15 	},
	{ insn: "mul.h %e0,%d3,%d4ll,1", 			name: "mul.h", 		operands: "Dd-1", 	format: 16 	},
	{ insn: "mul.h %e0,%d3,%d4lu,1", 			name: "mul.h", 		operands: "Ddl1", 	format: 16 	},
	{ insn: "mul.h %e0,%d3,%d4ul,1", 			name: "mul.h", 		operands: "DdL1", 	format: 16 	},
	{ insn: "mul.h %e0,%d3,%d4uu,1", 			name: "mul.h", 		operands: "Dd+1", 	format: 16 	},
	{ insn: "mul %d3,%d1,%d2", 						name: "mul", 			operands: "ddd", 		format: 17 	},
	{ insn: "mul %e2,%d5,%d1", 						name: "mul", 			operands: "Ddd", 		format: 17 	},
	{ insn: "imask %e2,%d1,5,11", 				name: "imask", 		operands: "Dd55", 	format: 18 	},
	{ insn: "add.f %d3,%d1,%d2", 					name: "add.f", 		operands: "ddd", 		format: 19  },
	{ insn: "cadd %d3,%d4,%d1,%d2", 			name: "cadd", 		operands: "dddd", 	format: 19 	},
	{ insn: "madd.h %e0,%e2,%d4,%d5ll,1", name: "madd.h", 	operands: "DDd-1", 	format: 20 	},
	{ insn: "madd.h %e0,%e2,%d4,%d5lu,1", name: "madd.h", 	operands: "DDdl1", 	format: 20 	},
	{ insn: "madd.h %e0,%e2,%d4,%d5ul,1", name: "madd.h", 	operands: "DDdL1", 	format: 20 	},
	{ insn: "madd.h %e0,%e2,%d4,%d5uu,1", name: "madd.h", 	operands: "DDd+1", 	format: 20 	},
	{ insn: "madd %d0,%d1,%d2,%d3", 			name: "madd", 		operands: "dddd", 	format: 21  },
	{ insn: "madd %e0,%e2,%d6,%d11", 			name: "madd", 		operands: "DDdd", 	format: 21  },
	{ insn: "insert %d3,%d1,%d2,%e4", 		name: "insert", 	operands: "dddD", 	format: 22  },
	{ insn: "insert %d3,%d1,%d2,%d4,8", 	name: "insert", 	operands: "dddd5", 	format: 23  },
	{ insn: "debug", 											name: "debug", 		operands: "", 			format: 32  },
	{ insn: "disable %d3", 								name: "disable",  operands: "d", 			format: 24  },
	{ insn: "jeq %d15,6,12", 							name: "jeq", 			operands: "i4m", 		format: 26  },
	{ insn: "jeq %d15,6,foobar", 					name: "jeq", 			operands: "i4x", 		format: 26  },
	{ insn: "jeq %d15,%d2,12",						name: "jeq", 			operands: "idm", 		format: 27 	},
	{ insn: "jeq %d15,%d2,foobar", 				name: "jeq", 			operands: "idx", 		format: 27 	},
	{ insn: "jz.t %d15,1,foobar", 				name: "jz.t", 		operands: "ifm", 		format: 28 	},
	{ insn: "mov %d15,126", 							name: "mov", 			operands: "i8", 		format: 29 	},
	{ insn: "ld.a %a4,[%a5]", 						name: "ld.a", 		operands: "a@", 		format: 30  },
	{ insn: "ld.a %a4,[%a5+]", 						name: "ld.a", 		operands: "a>", 		format: 30  },
	{ insn: "ld.a %a4,[%a15]+4", 					name: "ld.a", 		operands: "aS6", 		format: 31 	},
	{ insn: "ji %a2", 										name: "ji", 			operands: "a", 			format: 32  },
	{ insn: "add %d2,4", 									name: "add", 			operands: "d4", 		format: 33  },
	{ insn: "add %d2,%d15,4", 						name: "add", 			operands: "di4", 		format: 33 	},
	{ insn: "add %d15,%d2,4", 						name: "add", 			operands: "id4", 		format: 33  },
	{ insn: "ld.a %a15,[%a12]+4", 				name: "ld.a", 		operands: "I@6", 		format: 34 	},
	{ insn: "add %d0,%d1", 								name: "add", 			operands: "dd", 		format: 35 	},
	{ insn: "add %d0,%d15,%d1", 					name: "add", 			operands: "did", 		format: 35 	},
	{ insn: "add %d15,%d0,%d1", 					name: "add", 			operands: "idd", 		format: 35 	},
	{ insn: "addsc.a %a0,%a1,%d15,1", 		name: "addsc.a", 	operands: "aai2", 	format: 36  },
	{ insn: "st.a [%a1],%a0", 						name: "st.a", 		operands: "@a", 		format: 37  },
	{ insn: "st.a [%a1+],%a0", 						name: "st.a", 		operands: ">a", 		format: 37  },
	{ insn: "st.a [%a15]+4,%a1", 					name: "st.a", 		operands: "S6a", 		format: 38  }
];

let ps: Parser;
beforeAll(async () => {
	ps = new Parser();
});

describe.each(testDatas)("Tricore assembly instruction parser", (data) => {
	const { insn, name, operands, format } = data;
	const the_insn: tricore_insn_t = {
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

	test(name, () => {
		ps.tricore_ip(insn, the_insn);
		const opcode = ps.find_opcode(the_insn);
		expect(opcode).not.toBeUndefined();
		expect(opcode?.name).toBe(name);
		expect(opcode?.args).toBe(operands);
		expect(opcode?.format).toBe(format);
	})
});