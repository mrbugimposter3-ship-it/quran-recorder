const fs=require('fs');eval(fs.readFileSync(__dirname+'/../docs/surah-data.js','utf8').replace('const SURAHS','globalThis.SURAHS'));
const {parsePick}=require(__dirname+'/../docs/speak-parse.js');
const T=[['يس ٤٩','36:49'],['Yasin 49','36:49'],['36 49','36:49'],['surah 2 ayah 255','2:255'],['ياسين 49','36:49'],['سورة يس آية ٤٩','36:49'],
['البقرة ٢٥٥','2:255'],['البقره مئتين وخمسة وخمسين','2:255'],['al baqarah 255','2:255'],['Baqara two hundred fifty five','2:255'],['bakara 255','2:255'],
['al-fatiha 7','1:7'],['fateha 3','1:3'],['الفاتحة الآية الخامسة','1:5'],['first'+'','x'],['al kahf 10','18:10'],['kahaf ten','18:10'],['الكهف عشرة','18:10'],
['ar rahman 13','55:13'],['rehman 13','55:13'],['الرحمن ثلاث عشرة','55:13'],['al mulk 1','67:1'],['tabarak 2','67:2'],['تبارك ٢','67:2'],
['ikhlas 1','112:1'],['الإخلاص ١','112:1'],['nas 6','114:6'],['al naas 1','114:1'],['falaq 2','113:2'],['الفلق ٢','113:2'],['kausar 3','108:3'],
['waqiah 1','56:1'],['الواقعة ٧٧','56:77'],['maryam 16','19:16'],['mariam 16','19:16'],['yousuf 4','12:4'],['آل عمران ١٩٠','3:190'],['al imran 190','3:190'],
['ayah 255 surah 2','2:255'],['٢ ٢٥٥','2:255'],['طه ١٤','20:14'],['taha 14','20:14'],['ص ١','38:1'],['تسعة وثمانين','89:1'],['sura 18','18:1'],
['verse 4000','?'],['النور 35','24:35'],['an-nur 35','24:35'],['light 35','24:35'],['اية الكرسي','x'],['36:49','36:49'],['al-ankabut 41','29:41'],['العنكبوت ٤١','29:41'],
['ad duha 5','93:5'],['الضحى ٥','93:5'],['al asr 3','103:3'],['العصر ثلاثة','103:3'],['yasin 100','x'],['blah 3','x']];
let pass=0,fail=[];for(const[q,e]of T){const r=parsePick(q);const got=r.ok?r.surah+':'+r.ayah:'x';
 if(e==='?'){pass++;continue}if(got===e)pass++;else fail.push([q,e,got,r.reason])}
console.log(pass+'/'+T.length);console.log(fail);
if(fail.length)process.exit(1);
