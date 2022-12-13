import { preprocess } from "../../src/parser/parser";

describe("preprocess", () => {

  it("complete instruction line", () => {
    expect(preprocess("label:    mov %d2, %d1   # comment here \n")).toBe("label:mov %d2,%d1\n");
  });

  it("a label", () => {
    expect(preprocess("label: ")).toBe("label:");
  });

  it("dot label", () => {
    expect(preprocess(".label:")).toBe(".label:");
  });

  it("local label", () => {
    expect(preprocess("1: ")).toBe("1:");
  });

  it("a label with alternate syntax", () => {
    expect(preprocess("label$: ")).toBe("label$:");
  });

  it("a label with leading whitespace", () => {
    expect(preprocess(" \tlabel:  ")).toBe(" label:");
  });

  it("a label and mnemonic without whitespace", () => {
    expect(preprocess("label:ret")).toBe("label:ret");
  });

  it("a label and mnemonic with prefix operands", () => {
    expect(preprocess("   \t ld.w    %d5, hi:.LC0        # ABS       ")).toBe(" ld.w %d5,hi:.LC0");
  });

  it("mnemonic with label", () => {
    expect(preprocess(" main: mov.aa %a14, %SP ")).toBe(" main:mov.aa %a14,%SP");
  });

  it("mnemonic without label", () => {
    expect(preprocess(" \t mov %d1, %d2 \n")).toBe(" mov %d1,%d2\n");
  });

  it("mnemonic without operand", () => {
    expect(preprocess("  ret // comment here")).toBe(" ret ");
  });

  it("directive with label", () => {
    expect(preprocess("  .LC0: .global _foobar  ")).toBe(" .LC0:.global _foobar");
  });

  it("single slash comment", () => {
    expect(preprocess(" main: // single slash comment; ")).toBe(" main:");
  });

  it("single slash comment with linefeed", () => {
    expect(preprocess(" main: // single slash comment; \n")).toBe(" main:\n");
  });

  it("hash comment", () => {
    expect(preprocess(" ld.w %d5, hi:.LC0  # hash comment")).toBe(" ld.w %d5,hi:.LC0");
  });

  it("hash comment with linefeed", () => {
    expect(preprocess(" ld.w %d5, hi:.LC0  # hash comment\n ")).toBe(" ld.w %d5,hi:.LC0\n ");
  });

  it("multi line comment", () => {
    expect(preprocess(" ld.w %d5, hi:.LC0 /* comment here */")).toBe(" ld.w %d5,hi:.LC0");
    expect(preprocess(" ld.w %d5, hi:.LC0 /* comment here \n second line \n*/")).toBe(" ld.w %d5,hi:.LC0\n\n");
    expect(preprocess(" /  ")).toBe(" /");
    expect(preprocess('/')).toBe("/");
  });

  it("CarriageReturn", () => {
    expect(preprocess(" ld.w %d5, hi:.LC0   \r\n ")).toBe(" ld.w %d5,hi:.LC0\n ");
    expect(preprocess(" ld.w %d5, hi:.LC0   \r ")).toBe(" ld.w %d5,hi:.LC0\r");
  });

  it("single-quote string", () => {
    expect(preprocess(".sect    '.text.t.main'\n")).toBe(".sect '.text.t.main'\n");
  });

  it("double-quote string", () => {
    expect(preprocess('.sect    ".text.t.main"\n')).toBe('.sect ".text.t.main"\n');
  });
});