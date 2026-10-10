import { csvFileDigest } from '../import/import-identity.mjs';
import { storageError } from './period-projections.mjs';

export async function readLegacyCloudImports(headers,transport,{assembleCloudImport}){
  const imports=[];
  for(const entry of headers){
    const header=entry.data,id=entry.path.split('/').pop();
    if(Array.isArray(header.rows)){imports.push(header);continue;}
    if(header.lifecycle==='deleted'){imports.push({...header,rows:[]});continue;}
    if(!Number.isSafeInteger(header.chunkCount)||header.chunkCount<0||header.chunkCount>10000)throw storageError('migration-incomplete','De oude importindeling is ongeldig.');
    const chunks=[];
    for(let index=0;index<header.chunkCount;index++)chunks.push((await transport.get(entry.path+'/chunks/'+(header.generation?header.generation+'-':'')+String(index).padStart(4,'0')))?.data);
    const batch=assembleCloudImport(header,chunks,id);
    if(header.sourceChunkCount){
      if(!Number.isSafeInteger(header.sourceChunkCount)||header.sourceChunkCount<1||header.sourceChunkCount>10000)throw storageError('migration-incomplete','De oude CSV-indeling is ongeldig.');
      const texts=[];
      for(let index=0;index<header.sourceChunkCount;index++){
        const chunk=(await transport.get(entry.path+'/chunks/'+header.generation+'-source-'+index))?.data;
        if(chunk?.generation!==header.generation||chunk.index!==index||typeof chunk.text!=='string')throw storageError('migration-incomplete','Een oorspronkelijk CSV-deel ontbreekt.');texts.push(chunk.text);
      }
      batch.originalCsv=texts.join('');
      if(csvFileDigest(batch.originalCsv)!==header.fileDigest)throw storageError('migration-integrity','Originele CSV-controlecode wijkt af.');
    }
    batch.baseVersion=Number(header.version)||0;imports.push(batch);
  }
  return imports;
}
