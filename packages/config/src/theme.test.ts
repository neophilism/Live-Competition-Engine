import {describe,expect,it} from "vitest";
import {parseTenantTheme,requireTenantThemeScope} from "./theme";

const validTheme={
  logoPath:"/tenant-assets/logo.svg",
  colors:{primary:"#102A43",surface:"#F5F7FA",text:"#101820",accent:"#D64545"},
  typography:"humanist",
  template:"editorial",
  navigation:[{label:"Schedule",path:"/schedule"},{label:"Results",path:"/results"}]
};

describe("tenant theme configuration",()=>{
  it("accepts a domain-neutral theme",()=>{
    expect(parseTenantTheme(validTheme)).toEqual(validTheme);
  });

  it("rejects external assets and navigation destinations",()=>{
    expect(()=>parseTenantTheme({...validTheme,logoPath:"https://attacker.example/logo.svg"})).toThrow();
    expect(()=>parseTenantTheme({...validTheme,navigation:[{label:"Results",path:"//attacker.example"}]})).toThrow();
  });

  it("rejects custom CSS, unknown tokens, and duplicate navigation",()=>{
    expect(()=>parseTenantTheme({...validTheme,customCss:"body{display:none}"})).toThrow();
    expect(()=>parseTenantTheme({...validTheme,typography:"tenant-uploaded-font"})).toThrow();
    expect(()=>parseTenantTheme({...validTheme,navigation:[{label:"One",path:"/results"},{label:"Two",path:"/results"}]})).toThrow();
  });

  it("fails closed across tenant scope",()=>{
    expect(()=>requireTenantThemeScope("org-a","org-b")).toThrow(/denied/);
    expect(()=>requireTenantThemeScope("org-a","org-a")).not.toThrow();
  });
});
