import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir, mkdtemp, readdir, copyFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { parseCsv, prepareVocabulary, prepareVocabularyFiles } from "./import-vocabulary.mjs";

test("UTF-8 BOM·인용 쉼표·여러 줄 예문 보존", () => {
  assert.deepEqual(parseCsv('\uFEFFword,meaning,example\r\n"sample","표본","A sample, carefully\ncollected."'), [["word", "meaning", "example"], ["sample", "표본", "A sample, carefully\ncollected."]]);
});
test("실제 카탈로그와 템플릿 병합은 단어 수·기존 데이터 보존", async () => {
  const existing = JSON.parse(await readFile(new URL("../src/data/vocabulary.json", import.meta.url), "utf8"));
  const template = await readFile(new URL("../data/vocabulary-template.csv", import.meta.url), "utf8");
  const result = prepareVocabulary(template, existing);
  assert.equal(result.entries.length, existing.length);
  const imported = new Set(parseCsv(template).slice(1).filter(row => row[0]).map(row => row[0]));
  assert.deepEqual(result.entries.map(item => item.word), existing.map(item => item.word));
  assert.deepEqual(result.entries.filter(item => !imported.has(item.word)), existing.filter(item => !imported.has(item.word)));
  assert.equal(result.imported, imported.size);
});
test("중복·필수 필드·깨진 인용·동일 선택지 거부", () => {
  for (const csv of [
    "word,meaning,example\nalpha,뜻,First example.\nalpha,다름,Second example.",
    "word,meaning\nalpha,뜻", 'word,meaning,example\n"alpha,뜻,Example.',
    "word,meaning,example,synonym,decoy1,decoy2\nalpha,뜻,Example.,first,first,second",
    "word,meaning,example,decoy1\nalpha,뜻,Example.,second",
    'word,meaning,example\n"alpha"x,뜻,Example.',
  ]) assert.throws(() => prepareVocabulary(csv, []));
});

test("분할 파일의 열 순서 통합·파일 간 중복 거부·4000개 상한", () => {
  const first="word,meaning,example\nalpha,첫째,Alpha is the first letter.";
  const second="example,word,meaning\nBeta is the second letter.,beta,둘째\nGamma is another letter.,gamma,셋째";
  assert.equal(prepareVocabularyFiles([first,second],[]).entries.length,3);
  assert.throws(()=>prepareVocabularyFiles([first,first],[]));
  const word=i=>"term"+String.fromCharCode(97+Math.floor(i/676),97+Math.floor(i/26)%26,97+i%26);
  const header="word,meaning,example,synonym,decoy1,decoy2\n";
  const rows=Array.from({length:4001},(_,i)=>`${word(i)},뜻,This is an example.,match,wrong,other`);
  assert.equal(prepareVocabularyFiles([header+rows.slice(0,4000).join("\n")],[],true).entries.length,4000);
  assert.throws(()=>prepareVocabularyFiles([header+rows.join("\n")],[],true),/4,000/);
});

test("실제 CLI 검사 시 원본 유지·적용 시 백업·잘못된 인코딩 거부", async () => {
  const root=await mkdtemp(join(tmpdir(),"toefl-vocab-test-"));
  try {
    await mkdir(join(root,"scripts"));await mkdir(join(root,"src/data"),{recursive:true});await mkdir(join(root,"data"));
    await copyFile(new URL("./import-vocabulary.mjs",import.meta.url),join(root,"scripts/import-vocabulary.mjs"));
    const target=join(root,"src/data/vocabulary.json"),original=JSON.stringify([{word:"old",meaning:"기존",example:"The old building remains.",synonym:"previous",decoys:["new","later"]}]);
    await writeFile(target,original);
    await writeFile(join(root,"new.csv"),"word,meaning,example,synonym,decoy1,decoy2\nnew,새로운,A new idea emerged.,recent,old,ancient");
    const run=args=>execFileSync(process.execPath,[join(root,"scripts/import-vocabulary.mjs"),join(root,"new.csv"),...args],{encoding:"utf8",stdio:"pipe"});
    run(["--check"]);assert.equal(await readFile(target,"utf8"),original);
    run([]);assert.equal(JSON.parse(await readFile(target,"utf8")).length,2);
    const backups=await readdir(join(root,"data/vocabulary-backups"));assert.equal(backups.length,1);assert.equal(await readFile(join(root,"data/vocabulary-backups",backups[0]),"utf8"),original);
    const report=JSON.parse(await readFile(join(root,"data/vocabulary-import-report.json"),"utf8"));assert.equal(report.added,1);assert.equal(report.total,2);
    await writeFile(join(root,"new.csv"),Buffer.from([0xff,0xfe,0x61]));assert.throws(()=>run(["--check"]));
  } finally { if(!resolve(root).startsWith(resolve(tmpdir())+"\\toefl-vocab-test-") && !resolve(root).startsWith(resolve(tmpdir())+"/toefl-vocab-test-"))throw new Error("임시 폴더 경계 오류");await rm(root,{recursive:true,force:true}); }
});
test("선택지가 없는 3열 자료는 한국어 뜻 선택지로 구성", () => {
  const result = prepareVocabulary("word,meaning,example\nalpha,첫째,Alpha is the first letter.\nbeta,둘째,Beta is the second letter.\ngamma,셋째,Gamma is another letter.", [], true);
  assert.equal(result.generated, 3); assert.equal(result.entries[0].synonym, "첫째"); assert.equal(new Set([result.entries[0].synonym, ...result.entries[0].decoys]).size, 3);
});
test("명시적 전체 교체와 기본 병합 구분", () => {
  const existing = [{ word: "old", meaning: "기존", synonym: "previous", decoys: ["new", "later"], example: "The old building remains." }];
  const csv = "word,meaning,example,synonym,decoy1,decoy2\nnew,새로운,A new idea emerged.,recent,old,ancient";
  assert.equal(prepareVocabulary(csv, existing).entries.length, 2); assert.equal(prepareVocabulary(csv, existing, true).entries.length, 1);
});
