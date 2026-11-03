const dir = module.filename.replace(/\/[^\/]*$/, '');
const arq = dir + '/mesa-core.js', fm = FileManager.local();
try { const s = await new Request('https://raw.githubusercontent.com/eujoseo/mesa-de-prazos/main/widget/iphone/mesa-core.js').loadString(); if (s.includes('module.exports')) fm.writeString(arq, s); } catch (e) {}
await importModule('mesa-core')();
