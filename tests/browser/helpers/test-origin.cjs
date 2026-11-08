const port=Number(process.env.FINIZE_TEST_PORT||4173);
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('FINIZE_TEST_PORT moet een lokale testpoort tussen 1024 en 65535 zijn.');
module.exports=`http://127.0.0.1:${port}`;
