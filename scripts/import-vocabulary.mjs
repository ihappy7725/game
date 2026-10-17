import { readFile, writeFile, rename, mkdir, stat } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// UTF-8 CSV의 따옴표·쉼표·여러 줄 예문을 처리합니다. 외부 API를 호출하지 않습니다.
export function parseCsv(text) {
  const rows=[];let row=[],field="",quoted=false,closed=false;
  text=text.replace(/^\uFEFF/,"");
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='"'){if(quoted && text[i+1]==='"'){field+='"';i++;}else if(quoted){quoted=false;closed=true;}else if(!field && !closed)quoted=true;else throw new Error("따옴표 형식이 올바르지 않습니다.");}
    else if(c==="," && !quoted){row.push(field.trim());field="";closed=false;}
    else if((c==="\n" || c==="\r") && !quoted){if(c==="\r" && text[i+1]==="\n")i++;row.push(field.trim());if(row.some(Boolean))rows.push(row);row=[];field="";closed=false;}
    else { if(closed && !/\s/.test(c))throw new Error("닫힌 따옴표 뒤에 문자가 있습니다.");if(!closed)field+=c; }
  }
  if(quoted)throw new Error("닫히지 않은 따옴표가 있습니다.");
  row.push(field.trim());if(row.some(Boolean))rows.push(row);return rows;
}
export function prepareVocabulary(text,existing,replace=false) {
  const [header,...rows]=parseCsv(text);if(!header)throw new Error("비어 있는 CSV입니다.");
  const required=["word","meaning","example"];for(const name of required)if(!header.includes(name))throw new Error(`필수 열이 없습니다: ${name}`);
  if(new Set(header).size!==header.length)throw new Error("중복된 열 이름이 있습니다.");
  const source=new Map();
  for(const [i,row]of rows.entries()){
    if(row.length!==header.length)throw new Error(`${i+2}행의 열 수가 다릅니다.`);
    const item=Object.fromEntries(header.map((name,j)=>[name,row[j]]));item.word=item.word.toLowerCase().trim();
    if(!/^[a-z][a-z '-]{0,49}$/.test(item.word) || !item.meaning || !item.example)throw new Error(`${i+2}행의 단어·뜻·예문을 확인해 주세요.`);
    if(item.meaning.length>150 || item.example.length>700)throw new Error(`${i+2}행의 뜻 또는 예문이 너무 깁니다.`);
    if(source.has(item.word))throw new Error(`중복 단어가 있습니다: ${item.word}`);
    if(Boolean(item.decoy1)!==Boolean(item.decoy2))throw new Error(`${i+2}행의 오답은 두 개를 함께 입력해 주세요.`);
    source.set(item.word,item);
  }
  if(!source.size)throw new Error("단어가 없습니다.");
  const catalog=new Map((replace ? [] : existing).map(item=>[item.word,item]));
  for(const item of source.values())catalog.set(item.word,{word:item.word,meaning:item.meaning,example:item.example,synonym:item.synonym||item.meaning,decoys:item.decoy1 ? [item.decoy1,item.decoy2] : []});
  const result=[...catalog.values()];if(result.length>4000)throw new Error("4,000개를 초과합니다. 전체 목록으로 교체하려면 --replace를 사용하세요.");
  let generated=0;
  for(const item of result){
    if(item.decoys.length!==2){
      const options=result.filter(other=>other.word!==item.word && other.synonym!==item.synonym).map(other=>other.synonym);const unique=[...new Set(options)];
      if(unique.length<2)throw new Error("오답 자동 구성을 위해 서로 다른 뜻의 단어가 세 개 이상 필요합니다.");
      item.decoys=[unique[0],unique[Math.min(7,unique.length-1)]];generated++;
    }
    if(new Set([item.synonym,...item.decoys]).size!==3)throw new Error(`정답과 오답이 겹칩니다: ${item.word}`);
  }
  return {entries:result,imported:source.size,generated};
}
export function prepareVocabularyFiles(texts, existing, replace=false) {
  const columns=["word","meaning","example","synonym","decoy1","decoy2"];
  const quote=value=>'"'+value.replaceAll('"','""')+'"';
  const combined=[columns.join(",")];
  for(const text of texts) {
    const [header,...rows]=parseCsv(text);
    if(!header || new Set(header).size!==header.length || !columns.slice(0,3).every(name=>header.includes(name)))throw new Error("각 파일에 중복 없는 word, meaning, example 열이 필요합니다.");
    for(const row of rows){if(row.length!==header.length)throw new Error("CSV의 열 수가 다릅니다.");combined.push(columns.map(name=>quote(row[header.indexOf(name)]??"")).join(","));}
  }
  return prepareVocabulary(combined.join("\n"),existing,replace);
}
async function main(){
  const args=process.argv.slice(2),inputs=args.filter(arg=>!arg.startsWith("--"));if(!inputs.length)throw new Error("사용법: npm run vocab:import -- 파일.csv [추가파일.csv ...] [--check] [--replace]");
  if(args.some(arg=>arg.startsWith("--") && !["--check","--replace"].includes(arg)))throw new Error("알 수 없는 옵션입니다.");
  if(inputs.length>40)throw new Error("파일은 한 번에 최대 40개까지 가져옵니다.");
  const target=fileURLToPath(new URL("../src/data/vocabulary.json",import.meta.url));
  const original=await readFile(target,"utf8"),existing=JSON.parse(original),texts=[];
  for(const input of inputs){const path=resolve(input);if((await stat(path)).size>8*1024*1024)throw new Error("CSV 한 파일은 8MB 이하로 나눠 주세요.");try{texts.push(new TextDecoder("utf-8",{fatal:true}).decode(await readFile(path)));}catch{throw new Error("UTF-8 CSV를 읽지 못했습니다. CSV UTF-8로 다시 저장해 주세요.");}}
  const result=prepareVocabularyFiles(texts,existing,args.includes("--replace"));
  const old=new Map(existing.map(item=>[item.word,item]));
  const sameEntry=(a,b)=>["word","meaning","example","synonym","decoys"].every(key=>JSON.stringify(a[key])===JSON.stringify(b[key]));
  const report={mode:args.includes("--check")?"check":"import",files:inputs.length,imported:result.imported,total:result.entries.length,added:result.entries.filter(item=>!old.has(item.word)).length,updated:result.entries.filter(item=>old.has(item.word) && !sameEntry(old.get(item.word),item)).length,generatedDecoys:result.generated};
  if(!args.includes("--check")){
    const backup=fileURLToPath(new URL(`../data/vocabulary-backups/${Date.now()}-${randomUUID()}.json`,import.meta.url));
    await mkdir(fileURLToPath(new URL("../data/vocabulary-backups/",import.meta.url)),{recursive:true});await writeFile(backup,original,{encoding:"utf8",flag:"wx"});
    await writeFile(target+".tmp",JSON.stringify(result.entries,null,2)+"\n","utf8");await rename(target+".tmp",target);
  }
  await writeFile(fileURLToPath(new URL("../data/vocabulary-import-report.json",import.meta.url)),JSON.stringify(report,null,2)+"\n","utf8");
  console.log(`${args.includes("--check") ? "검사 완료" : "가져오기 완료"}: 입력 ${result.imported}개 · 전체 ${result.entries.length}개 · 오답 자동 구성 ${result.generated}개`);
  console.log(`신규 ${report.added}개 · 내용 변경 ${report.updated}개 · 결과: data/vocabulary-import-report.json`);
  if(result.generated)console.log("자동 구성한 오답은 뜻이 겹치지 않는지 검토해 주세요.");
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
