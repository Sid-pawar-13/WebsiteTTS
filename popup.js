const statusEl=document.getElementById("status");
const rate=document.getElementById("rate");
const provider=document.getElementById("provider");
const settingsStatus=document.getElementById("settingsStatus");
const providerHelp=document.getElementById("providerHelp");
const apiKeyGroup=document.getElementById("apiKeyGroup");
const saveButton=document.getElementById("save");
const DEFAULTS={
  ollama:{endpoint:"http://localhost:11434/v1",model:"phonon",voice:"default",apiKey:"ollama"},
  openai:{endpoint:"https://api.openai.com/v1",model:"gpt-4o-mini-tts",voice:"alloy",apiKey:""}
};
function showProviderHelp(){
  const local=provider.value==="ollama";
  apiKeyGroup.hidden=local;
  providerHelp.textContent=local
    ?"Phonon returns WAV audio. The API speed is fixed at 1; the slider changes playback speed. Ollama must allow this extension in OLLAMA_ORIGINS."
    :"Uses /audio/speech and MP3 output. An API key is required.";
}
function applyDefaults(){
  for(const [key,value] of Object.entries(DEFAULTS[provider.value]))document.getElementById(key).value=value;
  showProviderHelp();
  settingsStatus.textContent="Provider defaults filled in. Review and save.";
}
async function loadSettings(){
  try{
    const values=await chrome.storage.local.get({provider:"openai",...DEFAULTS.openai,speed:1});
    provider.value=values.provider==="ollama"?"ollama":"openai";
    for(const field of ["endpoint","model","voice","apiKey"])document.getElementById(field).value=values[field]??"";
    rate.value=String(values.speed||1);
    document.getElementById("rateValue").value=Number(rate.value).toFixed(1)+"×";
    showProviderHelp();
    settingsStatus.textContent="Settings loaded.";
  }catch(error){settingsStatus.textContent="Could not load settings: "+error.message;}
}
async function saveSettings(){
  saveButton.disabled=true;
  settingsStatus.textContent="Saving settings…";
  try{
    const values={
      provider:provider.value,
      endpoint:document.getElementById("endpoint").value.trim(),
      model:document.getElementById("model").value.trim(),
      voice:document.getElementById("voice").value.trim(),
      apiKey:document.getElementById("apiKey").value.trim(),
      speed:Number(rate.value)
    };
    if(!values.endpoint||!values.model||!values.voice)throw new Error("API URL, model and voice are required.");
    if(values.provider==="openai"&&!values.apiKey)throw new Error("API key is required for the OpenAI-compatible provider.");
    let parsed;
    try{parsed=new URL(values.endpoint);}catch{throw new Error("Enter a valid API URL, including http:// or https://.");}
    if(!["http:","https:"].includes(parsed.protocol))throw new Error("API URL must start with http:// or https://.");
    await chrome.storage.local.set(values);
    const saved=await chrome.storage.local.get(Object.keys(values));
    for(const key of Object.keys(values))if(saved[key]!==values[key])throw new Error("Settings could not be verified after saving.");
    settingsStatus.textContent="Settings saved and verified.";
  }catch(error){settingsStatus.textContent="Save failed: "+(error.message||"Unknown storage error");}
  finally{saveButton.disabled=false;}
}
async function send(command){
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  if(!tab?.id)return;
  try{
    const result=await chrome.tabs.sendMessage(tab.id,{command,rate:Number(rate.value)});
    if(result?.status){const s=result.status;statusEl.textContent=s.speaking?"Reading paragraph "+(s.index+1)+" of "+s.total:s.finished?"Finished reading":"Ready to read";}
    if(result?.error)statusEl.textContent=result.error;
  }catch{statusEl.textContent="This page cannot be read. Refresh the page and try again.";}
}
provider.addEventListener("change",applyDefaults);
saveButton.addEventListener("click",saveSettings);
document.getElementById("start").onclick=()=>send("start");
document.getElementById("stop").onclick=()=>send("stop");
document.getElementById("forward").onclick=()=>send("forward");
document.getElementById("backward").onclick=()=>send("backward");
rate.oninput=()=>{document.getElementById("rateValue").value=Number(rate.value).toFixed(1)+"×";send("setRate");};
loadSettings();
send("getStatus");