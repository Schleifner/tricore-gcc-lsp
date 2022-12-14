import Parser from '../../src/parser/parser'
import { TRICORE_INSN_T } from '../../src/parser/instruction';
 
type insFormatTestDatas = {
	insn: string;
	name: string;
	operands: string;
	format: number;
}[];

const _insFormatTestDatas: insFormatTestDatas = [
	{ insn: "ld.w %d4,3026", 							name: "ld.w", 		operands: "dt", 		format: 0 	},
	{ insn: "ld.w %d5,foobar", 						name: "ld.w", 		operands: "dt", 		format: 0 	},
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
	{ insn: "imask %d2+,6,5,11", 					name: "imask", 		operands: "Df55", 	format: 10 	},
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
	{ insn: "madd.q %d0,%d1,%d2,%d6U,1",  name: "madd.q",   operands: "dddG1",  format: 20  },
	{ insn: "madd.q %d0,%d2,%d1,%d3L,1",  name: "madd.q",   operands: "dddg1",  format: 20  },
	{ insn: "madd %d0,%d1,%d2,%d3", 			name: "madd", 		operands: "dddd", 	format: 21  },
	{ insn: "madd %e0,%e2,%d6,%d11", 			name: "madd", 		operands: "DDdd", 	format: 21  },
	{ insn: "insert %d3,%d1,%d2,%e4", 		name: "insert", 	operands: "dddD", 	format: 22  },
	{ insn: "insert %d3,%d1,%d2,%d4,8", 	name: "insert", 	operands: "dddd5", 	format: 23  },
	{ insn: "debug", 											name: "debug", 		operands: "", 			format: 32  },
	{ insn: "disable %d3", 								name: "disable",  operands: "d", 			format: 24  },
	{ insn: "jeq %d15,6,12", 							name: "jeq", 			operands: "i4m", 		format: 26  },
	{ insn: "jeq %d15,6,foobar", 					name: "jeq", 			operands: "i4x", 		format: 26  },
	{ insn: "jeq %d15,%d2,12",						name: "jeq", 			operands: "idm", 		format: 27 	},
	{ insn: "jeq %d15,%d2,1b", 						name: "jeq", 			operands: "idx", 		format: 27 	},
	{ insn: "jz.t %d15,1,foobar", 				name: "jz.t", 		operands: "ifm", 		format: 28 	},
	{ insn: "mov %d15,126", 							name: "mov", 			operands: "i8", 		format: 29 	},
	{ insn: "ld.a %sp,[%a5]", 						name: "ld.a", 		operands: "a@", 		format: 30  },
	{ insn: "ld.a %a4,[%sp+]", 						name: "ld.a", 		operands: "a>", 		format: 30  },
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
	{ insn: "st.a [%a10],%a0", 						name: "st.a", 		operands: "@a", 		format: 37  },
	{ insn: "st.a [%a1+],%a0", 						name: "st.a", 		operands: ">a", 		format: 37  },
	{ insn: "st.a [%a15]+4,%a1", 					name: "st.a", 		operands: "S6a", 		format: 38  },
	{ insn: "mov %d3,_GLOBAL_OFFSET_TABLE_", name: "mov",   operands: "dw",   	format: 14  },
	{ insn: "mov %d3,hi:_GLOBAL_OFFSET_TABLE_", name: "mov",   operands: "dw",   	format: 14  },
	{ insn: "mov %d3,lo:_GLOBAL_OFFSET_TABLE_", name: "mov",   operands: "dw",   	format: 14  },
	{ insn: "mov %d3,up:_GLOBAL_OFFSET_TABLE_", name: "mov",   operands: "dw",   	format: 14  },
	{ insn: "mfcr %d15,$pcxi",						name: "mfcr", 		operands: "dW", 		format: 14  },
	{ insn: "mov %d3,60", 								name: "mov",   		operands: "dw",   	format: 14  },
	{ insn: "mov %d3,hi:60", 							name: "mov",   		operands: "dw",   	format: 14  },
	{ insn: "mov %d3,1020", 						  name: "mov",   		operands: "dw",   	format: 14  },
];

let ps: Parser;
beforeAll(async () => {
	ps = new Parser();
});

describe.each(_insFormatTestDatas)("#md_assemble #tricore_ip #find_opcode positive test", (data) => {
	const { insn, name, operands, format } = data;
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

	test(`${name}-${format}}`, () => {
		ps.tricore_ip(insn, the_insn);
		const opcode = ps.find_opcode(the_insn);
		expect(opcode).not.toBeUndefined();
		expect(opcode?.name).toBe(name);
		expect(opcode?.args).toBe(operands);
		expect(opcode?.format).toBe(format);
		expect(ps.md_assemble(insn)).toBeUndefined();
	})
});

describe("#md_assemble #tricore_ip #find_opcode negative test", () => {
	test("displacement is not even", () => {
		expect(ps.md_assemble("jeq %d1,6,0x25")).toBe("displacement is not even");
	});

	test("opcode/operand mismatch", () => {
		expect(ps.md_assemble("abs %d1,,%a10")).toBe("opcode/operand mismatch: abs %d1,,%a10");
		expect(ps.md_assemble("abs %d1,%a10")).toBe("opcode/operand mismatch: abs %d1,%a10");
	});
	
	test("invalid register number", () => {
		expect(ps.md_assemble("mov %d18, 32")).toBe("invalid register number");
		expect(ps.md_assemble("st.a [%a18]-12,%a4")).toBe("invalid register number");
	});

	test("missing register number", () => {
		expect(ps.md_assemble("mov %d, 32")).toBe("missing register number");
	});

	test("trailing chars after register specification", () => {
		expect(ps.md_assemble("madd.q %d0,%d1,%d2,%d6x,1")).toBe("trailing chars after register specification");
	});

	test("illegal prefix for GOT expression", () => {
		expect(ps.md_assemble("mov %d4,sm:_GLOBAL_OFFSET_TABLE_")).toBe("illegal prefix for GOT expression");
	});

	test("illegal constant bit position", () => {
		expect(ps.md_assemble("ld.w %d4,bpos:32")).toBe("illegal constant bit position");
	});

	test("bad numeric constant", () => {
		expect(ps.md_assemble("mov %d3,1.33")).toBe("bad numeric constant");
	});

	test("illegal prefix for constant expression", () => {
		expect(ps.md_assemble("mov %d3,sbreg:32")).toBe("illegal prefix for constant expression");
	});
	
	test("unknown instruction", () => {
		expect(ps.md_assemble("move %d3,%d5")).toBe("unknown instruction");
	});

	test("too many operands", () => {
		expect(ps.md_assemble("abs %d3,%d5,%d2,%d1,%d6,%d7")).toBe("too many operands");
	});

	test("invalid register specification", () => {
		expect(ps.md_assemble("mov %d3,%x5")).toBe("invalid register specification");
	});

	test("invalid extended register specification", () => {
		expect(ps.md_assemble("imask %e3,6,5,11")).toBe("invalid extended register specification");
	});

	test("missing address register", () => {
		expect(ps.md_assemble("st.a [,%a4")).toBe("missing address register");
		expect(ps.md_assemble("st.a [a,%a4")).toBe("missing address register");
	});

	test("invalid or missing address register", () => {
		expect(ps.md_assemble("st.a [%x5],%a4")).toBe("invalid or missing address register");
	});

	test("missing ']'", () => {
		expect(ps.md_assemble("st.a [%a5,%a4")).toBe("missing ']'");
		expect(ps.md_assemble("st.a [%a5+,%a4")).toBe("missing ']'");
		expect(ps.md_assemble("st.a [%a2+r,%a4")).toBe("missing ']'");
		expect(ps.md_assemble("st.a [%a2+c,%a4")).toBe("missing ']'");
		expect(ps.md_assemble("st.a [%a2+i,%a4")).toBe("missing ']'");
	});

	test("invalid address mode", () => {
		expect(ps.md_assemble("st.a [+%a5+],%a4")).toBe("invalid address mode");
	});

	test("complex expression", () => {
		expect(ps.md_assemble("st.a [%a5]+24+12,%a4")).toBeUndefined;
		expect(ps.md_assemble("st.a [%a5+]+24+12,%a4")).toBeUndefined;
	});

	test("even address register required", () => {
		expect(ps.md_assemble("st.a [%a5+r]-4,%a4")).toBe("even address register required");
		expect(ps.md_assemble("st.a [%a5+c]-4,%a4")).toBe("even address register required");
		expect(ps.md_assemble("st.a [%a5+i]-4,%a4")).toBe("even address register required");
	});
});

type numericTestDatas = {
	num: number;
	type: string,
}[];

const _numericTestDatas: numericTestDatas = [
	{ num: -6, 			type: "4" },
	{ num: -14, 		type: "F" },
	{ num: -28, 		type: "r" },
	{ num: -128, 		type: "R" },
	{ num: -131, 		type: "9" },
	{ num: -288, 		type: "0" },
	{ num: -16384,  type: "o" },
	{ num: -16385,  type: "w" },
	{ num: -32796,  type: "O" },
	{ num: 1, 			type: "1" },
	{ num: 3, 			type: "2" },
	{ num: 6, 			type: "3" },
	{ num: 14, 			type: "f" },
	{ num: 28, 			type: "v" },
	{ num: 27, 			type: "5" },
	{ num: 31, 			type: "5" },
	{ num: 60,			type: "6" },
	{ num: 62, 			type: "x" },
	{ num: 128, 		type: "8" },
	{ num: 264,     type: "n" },
	{ num: 1020, 		type: "k" },
	{ num: 1021,		type: "h" },
	{ num: 16384,   type: "q" },
	{ num: 32776,   type: "W" },
	{ num: 65544,   type: "O" },
	{ num: 4026531840, type: "t" },
	{ num: 268451840,  type: "T" },
	{ num: 270532608,  type: "V" },
	{ num: 2097149,    type: "M" }
];

describe.each(_numericTestDatas)("#classify_numeric", (data) => {
	const { num, type } = data;
	test(type, () => {
		expect(ps.classify_numeric(num)).toBe(type);
	});
});