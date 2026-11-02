
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const STORAGE_KEY = "focustogether-v1";
const LIVEKIT_SERVER_URL = "wss://focustogather-9qe843tc.livekit.cloud";
const today = new Date();
const dateKey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const uid = () => Math.random().toString(36).slice(2,9).toUpperCase();
const uuid = () => {
  if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const r = Math.random() * 16 | 0;
    const value = char === "x" ? r : (r & 0x3 | 0x8);
    return value.toString(16);
  });
};
let data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") || {name:"Student",bio:"",avatarDataUrl:"",groups:[],tasks:[],sessions:[],notes:[],studyLog:{},chat:[]};
data.bio = data.bio || "";
data.avatarDataUrl = data.avatarDataUrl || "";
data.studyHistory = Array.isArray(data.studyHistory) ? data.studyHistory : [];
data.resourceFolders = Array.isArray(data.resourceFolders) ? data.resourceFolders : [];
data.dailyGoalText = typeof data.dailyGoalText==="string"?data.dailyGoalText:"";
data.dailyGoalDate = typeof data.dailyGoalDate==="string"?data.dailyGoalDate:dateKey(new Date());
data.dailyGoalCompleted = data.dailyGoalCompleted===true;
data.weeklyGoalText = typeof data.weeklyGoalText==="string"?data.weeklyGoalText:"";
data.weeklyGoalWeekStart = typeof data.weeklyGoalWeekStart==="string"?data.weeklyGoalWeekStart:"";
data.weeklyGoalCompleted = data.weeklyGoalCompleted===true;
data.progressStartDate = typeof data.progressStartDate==="string"?data.progressStartDate:(()=>{const date=new Date();date.setDate(date.getDate()-6);return dateKey(date)})();
data.progressEndDate = typeof data.progressEndDate==="string"?data.progressEndDate:dateKey(new Date());
let seconds = 25*60, initialSeconds = seconds, timerInterval = null, timerRunning = false, timerIsBreak = false, activeStream = null;
const THEME_KEY = "focustogether-theme";
let dailyGoalLoadedUserId="", studyHistoryLoadedUserId="";
function weekStartKey(date=new Date()){const monday=new Date(date);monday.setHours(0,0,0,0);monday.setDate(monday.getDate()-((monday.getDay()+6)%7));return dateKey(monday)}
function resetExpiredStudyGoals(){const todayKey=dateKey(new Date()),currentWeekStart=weekStartKey();let changed=false;if(data.dailyGoalDate!==todayKey){data.dailyGoalDate=todayKey;data.dailyGoalCompleted=false;changed=true}if(data.weeklyGoalWeekStart!==currentWeekStart){data.weeklyGoalWeekStart=currentWeekStart;data.weeklyGoalCompleted=false;changed=true}return changed}
if(resetExpiredStudyGoals())localStorage.setItem(STORAGE_KEY,JSON.stringify(data));
function applyTheme(theme){const isDark=theme==="dark";document.body.dataset.theme=isDark?"dark":"light";const button=$("#themeToggle");if(button){button.textContent=isDark?"☾":"☀";button.title=isDark?"Switch to day nature theme":"Switch to night galaxy theme";button.setAttribute("aria-label",button.title);button.setAttribute("aria-pressed",String(isDark))}}
applyTheme(localStorage.getItem(THEME_KEY)||"light");
$("#themeToggle").addEventListener("click",()=>{const theme=document.body.dataset.theme==="dark"?"light":"dark";localStorage.setItem(THEME_KEY,theme);applyTheme(theme)});
function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(data));renderAll();updateProfileUI()}
function escapeHtml(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function showNotice(msg){const n=$("#notice");n.textContent=msg;n.classList.remove("hidden");clearTimeout(showNotice.t);showNotice.t=setTimeout(()=>n.classList.add("hidden"),4500)}
function showView(view){$$(".view").forEach(v=>v.classList.add("hidden"));$("#view-"+view).classList.remove("hidden");$$(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===view));const titles={dashboard:"Good study session.","analysis-progress":"Analysis & Progress",groups:"Your learning circles.",friends:"Study friends.",sessions:"Make time to learn.", "study-history":"Study history",notes:"Your study library.",assistant:"Let's learn something."};$("#pageTitle").textContent=titles[view]||"FocusTogether";if(view==="assistant"){renderChat();renderAssistantNotes()}}
$$(".nav-item").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.view)));
$$("[data-go]").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.go)));
$("#todayLabel").textContent=today.toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric"}).toUpperCase();
function openDialog(id){const d=$("#"+id);if(d.showModal)d.showModal();else d.setAttribute("open","")}
function closeDialog(id){const d=$("#"+id);if(d.close)d.close();else d.removeAttribute("open")}
function renderAll(){renderDashboard();renderGroups();renderFriends();renderSessions();renderStudyHistory();renderDailyGoal();renderNotes();renderAssistantNotes();renderStats();renderAnalysisProgress();fillGroupSelects();renderResourceFolderOptions()}
function getStudyMinutesForDate(key){return studyHistoryLoadedUserId?data.studyHistory.filter(session=>session.userId===studyHistoryLoadedUserId&&dateKey(new Date(session.completedAt))===key).reduce((total,session)=>total+session.minutes,0):data.studyLog[key]||0}
function getCurrentWeekDays(){const monday=new Date();monday.setHours(0,0,0,0);monday.setDate(monday.getDate()-((monday.getDay()+6)%7));return Array.from({length:7},(_,index)=>{const date=new Date(monday);date.setDate(monday.getDate()+index);const key=dateKey(date);const sessions=data.studyHistory.filter(session=>(!studyHistoryLoadedUserId||session.userId===studyHistoryLoadedUserId)&&dateKey(new Date(session.completedAt))===key);return{date,key,label:date.toLocaleDateString(undefined,{weekday:"short"}),minutes:getStudyMinutesForDate(key),sessions:sessions.length}})}
function renderDailyGoal(){const input=$("#dailyGoalInput");if(!input)return;input.value=data.dailyGoalText;$("#dailyGoalProgressText").textContent=data.dailyGoalText||"Write one goal for today.";$("#dailyGoalStatus").textContent=data.dailyGoalText?(data.dailyGoalCompleted?"Complete":"Incomplete"):"Set a goal to get started.";$("#dailyGoalStatus").classList.toggle("is-achieved",data.dailyGoalCompleted);const toggle=$("#dailyGoalToggle");toggle.disabled=!data.dailyGoalText;toggle.textContent=data.dailyGoalCompleted?"Mark incomplete":"Mark complete";toggle.setAttribute("aria-pressed",String(data.dailyGoalCompleted))}
function studyGoalsCloudRow(userId){return{user_id:userId,daily_goal_text:data.dailyGoalText,daily_goal_date:data.dailyGoalDate,daily_goal_completed:data.dailyGoalCompleted,weekly_goal_text:data.weeklyGoalText,weekly_goal_week_start:data.weeklyGoalWeekStart,weekly_goal_completed:data.weeklyGoalCompleted,updated_at:new Date().toISOString()}}
async function loadDailyGoal(client,userId){if(dailyGoalLoadedUserId===userId)return;const {data:goal,error}=await client.from("study_daily_goals").select("daily_goal_text,daily_goal_date,daily_goal_completed,weekly_goal_text,weekly_goal_week_start,weekly_goal_completed").eq("user_id",userId).maybeSingle();if(error)throw error;if(goal){data.dailyGoalText=goal.daily_goal_text||"";data.dailyGoalDate=goal.daily_goal_date||dateKey(new Date());data.dailyGoalCompleted=goal.daily_goal_completed===true;data.weeklyGoalText=goal.weekly_goal_text||"";data.weeklyGoalWeekStart=goal.weekly_goal_week_start||weekStartKey();data.weeklyGoalCompleted=goal.weekly_goal_completed===true}resetExpiredStudyGoals();const {error:syncError}=await client.from("study_daily_goals").upsert(studyGoalsCloudRow(userId),{onConflict:"user_id"});if(syncError)throw syncError;dailyGoalLoadedUserId=userId}
async function refreshStudyGoalsForNewPeriod(){if(!resetExpiredStudyGoals())return;save();try{const client=getSupabaseClient(),userId=await getCurrentUserId();if(client&&userId){const {error}=await client.from("study_daily_goals").upsert(studyGoalsCloudRow(userId),{onConflict:"user_id"});if(error)throw error;dailyGoalLoadedUserId=userId}}catch(error){console.error("Unable to reset study goals for the new period:",error);showNotice("The new day or week started, but goal status could not sync: "+error.message)}}
function renderStudyHistory(){const list=$("#studyHistoryList");if(!list)return;const history=[...data.studyHistory].sort((a,b)=>b.completedAt.localeCompare(a.completedAt));list.classList.toggle("empty-state",!history.length);list.innerHTML=history.length?history.map(session=>{const completedAt=new Date(session.completedAt);return `<article class="session-item"><div class="date-chip"><strong>${completedAt.getDate()}</strong>${completedAt.toLocaleDateString(undefined,{month:"short"}).toUpperCase()}</div><div class="item-main"><strong>Focus session · ${session.minutes} minutes</strong><small>${completedAt.toLocaleString()}</small></div></article>`}).join(""):"Complete a focus session to start building your history."}
async function syncStudyHistory(client,userId){const pending=data.studyHistory.filter(session=>session.userId===userId&&!session.cloudSynced);if(!pending.length)return;const {error}=await client.from("study_focus_history").upsert(pending.map(session=>({id:session.id,user_id:userId,minutes:session.minutes,completed_at:session.completedAt})),{onConflict:"id"});if(error)throw error;pending.forEach(session=>{session.cloudSynced=true});localStorage.setItem(STORAGE_KEY,JSON.stringify(data))}
async function loadStudyHistory(client,userId){if(studyHistoryLoadedUserId===userId){await syncStudyHistory(client,userId);return}const {data:history,error}=await client.from("study_focus_history").select("id,minutes,completed_at").eq("user_id",userId).order("completed_at",{ascending:false});if(error)throw error;const byId=new Map();(history||[]).forEach(session=>byId.set(session.id,{id:session.id,userId,minutes:session.minutes,completedAt:session.completed_at,cloudSynced:true}));data.studyHistory=[...data.studyHistory.filter(session=>session.userId===userId),...byId.values()];await syncStudyHistory(client,userId);studyHistoryLoadedUserId=userId}
async function recordCompletedStudySession(minutes){const session={id:uuid(),userId:null,minutes,completedAt:new Date().toISOString(),cloudSynced:false};data.studyHistory.push(session);save();const userId=await getCurrentUserId();if(!userId)return;session.userId=userId;save();const client=getSupabaseClient();if(!client)throw new Error("Supabase is unavailable.");await syncStudyHistory(client,userId)}
let studyFriends=[], incomingFriendRequests=[], friendPresenceChannels=new Map(), friendPresenceUserId="", friendPresenceError=false, syncedProfileUserId="", syncedProfileName="", syncedProfilePhoto="", syncedProfileBio="", myFriendUid="";
function renderFriends(){
  const list=$("#friendsList");
  if(!list)return;
  const onlineIds=new Set();
  friendPresenceChannels.forEach(channel=>Object.keys(channel.presenceState()).forEach(userId=>{if(userId!==friendPresenceUserId)onlineIds.add(userId)}));
  const onlineCount=studyFriends.filter(friend=>onlineIds.has(friend.userId)).length;
  $("#onlineFriendCount").textContent=String(onlineCount);
  $("#onlineFriendCount").parentElement.classList.toggle("has-online",onlineCount>0);
  $("#myFriendUid").textContent=myFriendUid||"Loading…";
  list.classList.toggle("friends-empty",!studyFriends.length);
  if(!studyFriends.length){
    list.textContent="No friends yet. Search for someone's friend UID or join a study group.";
  }else{
    list.innerHTML=studyFriends.map(friend=>{
      const online=onlineIds.has(friend.userId),status=friendPresenceError?"Status unavailable":online?"Online":"Offline";
      const avatar=friend.photo?`<img src="${escapeHtml(friend.photo)}" alt="${escapeHtml(friend.name)}'s profile photo"/>`:escapeHtml(friend.name[0]?.toUpperCase()||"S");
      const groups=friend.groups.length?escapeHtml(friend.groups.join(", ")):"Added by friend UID";
      return `<article class="friend-row${online?" is-online":""}"><div class="friend-avatar">${avatar}</div><div class="friend-details"><strong>${escapeHtml(friend.name)}</strong><small>${groups}</small><small class="friend-uid-label">${escapeHtml(friend.friendUid||"UID unavailable")}</small></div><span class="friend-status"><i class="friend-status-dot"></i>${status}</span></article>`;
    }).join("");
  }
  const requests=$("#incomingFriendRequests");
  if(requests)requests.innerHTML=incomingFriendRequests.length?incomingFriendRequests.map(request=>{
    const avatar=request.photo?`<img src="${escapeHtml(request.photo)}" alt="${escapeHtml(request.name)}'s profile photo"/>`:escapeHtml(request.name[0]?.toUpperCase()||"S");
    return `<article class="friend-request-row"><div class="friend-avatar">${avatar}</div><div class="friend-details"><strong>${escapeHtml(request.name)}</strong><small class="friend-uid-label">${escapeHtml(request.friendUid)}</small></div><button class="primary-button" data-accept-friend="${request.id}">Accept</button><button class="secondary-button" data-decline-friend="${request.id}">Ignore</button></article>`;
  }).join(""):'<div class="friend-request-empty">No new requests.</div>';
}
function renderStats(){
  const total=Object.values(data.studyLog).reduce((a,b)=>a+b,0);
  $("#totalTime").textContent=`${Math.floor(total/60)}h ${String(total%60).padStart(2,"0")}m`;
  let streak=0;
  for(let i=0;i<366;i++){const d=new Date();d.setDate(d.getDate()-i);if((data.studyLog[dateKey(d)]||0)>0)streak++;else if(i>0)break}
  $("#streak").textContent=`${streak} ${streak===1?"day":"days"}`;
  $("#completedCount").textContent=data.tasks.filter(t=>t.done).length;
  $("#groupCount").textContent=data.groups.length;
}
function renderAnalysisProgress(){
  const dailyInput=$("#dailyGoalInput"),weeklyInput=$("#weeklyGoalInput");
  if(!dailyInput||!weeklyInput)return;
  const days=getCurrentWeekDays();
  const weekMinutes=days.reduce((sum,day)=>sum+day.minutes,0);
  const now=new Date(),todayKey=dateKey(now);
  const monthMinutes=Array.from({length:now.getDate()},(_,index)=>{const date=new Date(now.getFullYear(),now.getMonth(),index+1);return getStudyMinutesForDate(dateKey(date))}).reduce((sum,minutes)=>sum+minutes,0);
  const activeGoals=[data.dailyGoalText&&data.dailyGoalDate===todayKey?data.dailyGoalCompleted:null,data.weeklyGoalText&&data.weeklyGoalWeekStart===weekStartKey()?data.weeklyGoalCompleted:null].filter(value=>value!==null);
  const completedGoals=activeGoals.filter(Boolean).length,goalPercent=activeGoals.length?Math.round(completedGoals/activeGoals.length*100):0;
  const activityDates=new Set();
  if(studyHistoryLoadedUserId){
    data.studyHistory.filter(session=>session.userId===studyHistoryLoadedUserId&&Number(session.minutes)>0).forEach(session=>activityDates.add(dateKey(new Date(session.completedAt))));
  }else{
    Object.entries(data.studyLog).forEach(([key,minutes])=>{if(Number(minutes)>0)activityDates.add(key)});
    data.studyHistory.filter(session=>Number(session.minutes)>0).forEach(session=>activityDates.add(dateKey(new Date(session.completedAt))));
  }
  let streak=0;
  for(let offset=0;offset<366;offset++){
    const date=new Date();date.setHours(0,0,0,0);date.setDate(date.getDate()-offset);
    if(offset===0&&!activityDates.has(dateKey(date)))continue;
    if(activityDates.has(dateKey(date)))streak++;else break;
  }
  const duration=minutes=>`${Math.floor(minutes/60)}h ${String(minutes%60).padStart(2,"0")}m`;
  $("#todayFocusStat").textContent=duration(getStudyMinutesForDate(todayKey));
  $("#weeklyFocusStat").textContent=duration(weekMinutes);
  $("#monthlyFocusStat").textContent=duration(monthMinutes);
  $("#goalCompletionStat").textContent=`${goalPercent}%`;
  $("#goalCompletionDetail").textContent=activeGoals.length?`${completedGoals} of ${activeGoals.length} active goals complete`:"Set a daily or weekly goal";
  $("#studyStreakStat").textContent=`${streak} ${streak===1?"day":"days"}`;
  const weeklyGoalPercent=data.weeklyGoalText&&data.weeklyGoalCompleted?100:0;
  dailyInput.value=data.dailyGoalText;
  weeklyInput.value=data.weeklyGoalText;
  $("#dailyGoalProgressText").textContent=data.dailyGoalText||"Write one goal for today.";
  $("#dailyGoalStatus").textContent=data.dailyGoalText?(data.dailyGoalCompleted?"Complete":"Incomplete"):"Set a goal to get started.";
  $("#dailyGoalStatus").classList.toggle("is-achieved",data.dailyGoalCompleted);
  $("#dailyGoalToggle").disabled=!data.dailyGoalText;
  $("#dailyGoalToggle").textContent=data.dailyGoalCompleted?"Mark incomplete":"Mark complete";
  $("#dailyGoalToggle").setAttribute("aria-pressed",String(data.dailyGoalCompleted));
  $("#weekGoalSummary").textContent=data.weeklyGoalText||"Write one goal for this week.";
  $("#weeklyGoalStatus").textContent=data.weeklyGoalText?(data.weeklyGoalCompleted?"Complete":"Incomplete"):"Set a goal to get started.";
  $("#weeklyGoalStatus").classList.toggle("is-achieved",data.weeklyGoalCompleted);
  $("#weeklyGoalToggle").disabled=!data.weeklyGoalText;
  $("#weeklyGoalToggle").textContent=data.weeklyGoalCompleted?"Mark incomplete":"Mark complete";
  $("#weeklyGoalToggle").setAttribute("aria-pressed",String(data.weeklyGoalCompleted));
  $("#weeklyPieChart").style.setProperty("--weekly-goal-percent",`${weeklyGoalPercent}%`);
  $("#weeklyPieChart").setAttribute("aria-label",data.weeklyGoalText?(data.weeklyGoalCompleted?"Weekly goal complete":"Weekly goal incomplete"):"Set a weekly goal");
  $("#weekGoalPercent").textContent=`${weeklyGoalPercent}%`;
  renderProgressCalendar();
}
function renderProgressCalendar(){
  const startInput=$("#progressStartDate"),endInput=$("#progressEndDate");
  if(!startInput||!endInput)return;
  startInput.value=data.progressStartDate;
  endInput.value=data.progressEndDate;
  const start=new Date(`${data.progressStartDate}T00:00:00`),end=new Date(`${data.progressEndDate}T00:00:00`);
  const days=[],minutesByDate=new Map(),tasksByDate=new Map();
  $$("[data-progress-days]").forEach(button=>{
    const presetEnd=dateKey(new Date()),presetStart=new Date(`${presetEnd}T00:00:00`);
    presetStart.setDate(presetStart.getDate()-Number(button.dataset.progressDays)+1);
    const selected=data.progressEndDate===presetEnd&&data.progressStartDate===dateKey(presetStart);
    button.setAttribute("aria-pressed",String(selected));
  });
  for(const session of data.studyHistory){
    if(studyHistoryLoadedUserId&&session.userId!==studyHistoryLoadedUserId)continue;
    const key=dateKey(new Date(session.completedAt));
    minutesByDate.set(key,(minutesByDate.get(key)||0)+session.minutes);
  }
  if(!studyHistoryLoadedUserId)Object.entries(data.studyLog).forEach(([key,minutes])=>minutesByDate.set(key,Math.max(minutesByDate.get(key)||0,minutes)));
  let undatedCompleted=0;
  data.tasks.forEach(task=>{
    if(!task.done)return;
    if(!task.completedAt){undatedCompleted++;return}
    const key=dateKey(new Date(task.completedAt));
    if(key<data.progressStartDate||key>data.progressEndDate)return;
    if(!tasksByDate.has(key))tasksByDate.set(key,[]);
    tasksByDate.get(key).push(task);
  });
  const cursor=new Date(start);
  while(cursor<=end){
    const key=dateKey(cursor);
    days.push({date:new Date(cursor),key,minutes:minutesByDate.get(key)||0,tasks:tasksByDate.get(key)||[]});
    cursor.setDate(cursor.getDate()+1);
  }
  const totalMinutes=days.reduce((sum,day)=>sum+day.minutes,0);
  const completedTasks=days.reduce((sum,day)=>sum+day.tasks.length,0);
  const totalSessions=data.studyHistory.filter(session=>{
    if(studyHistoryLoadedUserId&&session.userId!==studyHistoryLoadedUserId)return false;
    const key=dateKey(new Date(session.completedAt));
    return key>=data.progressStartDate&&key<=data.progressEndDate;
  }).length;
  const activeDays=days.filter(day=>day.minutes>0).length;
  $("#progressRangeLabel").textContent=`${start.toLocaleDateString(undefined,{month:"long",day:"numeric",year:"numeric"})} – ${end.toLocaleDateString(undefined,{month:"long",day:"numeric",year:"numeric"})}`;
  $("#progressRangeTotals").textContent=`${totalMinutes} focus minutes · ${completedTasks} tasks completed · ${totalSessions} focus sessions`;
  renderRangeProgressCharts(days,activeDays);
  renderTaskBreakdowns(data.progressStartDate,data.progressEndDate);
  const undatedNote=$("#undatedCompletedTasks");
  undatedNote.textContent=undatedCompleted?`${undatedCompleted} previously completed ${undatedCompleted===1?"task has":"tasks have"} no completion date yet, so ${undatedCompleted===1?"it is":"they are"} not included in this date range.`:"";
  undatedNote.classList.toggle("hidden",!undatedCompleted);
  const months=new Map();
  days.forEach(day=>{
    const monthKey=`${day.date.getFullYear()}-${day.date.getMonth()}`;
    if(!months.has(monthKey))months.set(monthKey,{date:day.date,days:[]});
    months.get(monthKey).days.push(day);
  });
  $("#progressCalendar").innerHTML=[...months.values()].map(month=>{
    const offset=(new Date(month.date.getFullYear(),month.date.getMonth(),1).getDay()+6)%7;
    const blanks=Array.from({length:offset},()=>'<div class="calendar-day calendar-day-empty" aria-hidden="true"></div>').join("");
    const cells=month.days.map(day=>{
      const taskNames=day.tasks.map(task=>escapeHtml(task.title)).join(", ");
      const intensity=day.minutes?Math.min(4,Math.ceil(day.minutes/60)):0;
      const detail=[`${day.minutes} focus minutes`,`${day.tasks.length} tasks completed`,taskNames].filter(Boolean).join(" · ");
      return `<article class="calendar-day${day.minutes||day.tasks.length?" has-progress":""}" data-intensity="${intensity}" title="${escapeHtml(detail)}"><strong>${day.date.getDate()}</strong><span>${day.minutes} min</span><small>${day.tasks.length} ${day.tasks.length===1?"task":"tasks"}</small>${taskNames?`<em>${taskNames}</em>`:""}</article>`;
    }).join("");
    return `<section class="progress-calendar-month"><h4>${month.date.toLocaleDateString(undefined,{month:"long",year:"numeric"})}</h4><div class="calendar-weekdays"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div><div class="calendar-month-grid">${blanks}${cells}</div></section>`;
  }).join("");
}
function renderRangeProgressCharts(days,activeDays){
  const totalDays=days.length,percentage=totalDays?Math.round(activeDays/totalDays*100):0;
  const bucketSize=totalDays>31?7:1,buckets=[];
  for(let index=0;index<days.length;index+=bucketSize){
    const bucketDays=days.slice(index,index+bucketSize);
    buckets.push({
      label:bucketSize===1?(totalDays>14?bucketDays[0].date.toLocaleDateString(undefined,{month:"short",day:"numeric"}):String(bucketDays[0].date.getDate())):`${bucketDays[0].date.getDate()}–${bucketDays[bucketDays.length-1].date.getDate()}`,
      title:`${bucketDays[0].date.toLocaleDateString(undefined,{month:"short",day:"numeric"})}${bucketDays.length>1?` – ${bucketDays[bucketDays.length-1].date.toLocaleDateString(undefined,{month:"short",day:"numeric"})}`:""}`,
      minutes:bucketDays.reduce((sum,day)=>sum+day.minutes,0)
    });
  }
  const maxMinutes=Math.max(30,Math.ceil(Math.max(0,...buckets.map(bucket=>bucket.minutes))/30)*30);
  const plot={left:42,top:12,width:430,height:170},slotWidth=plot.width/Math.max(1,buckets.length),barWidth=Math.min(32,slotWidth*.62);
  const grid=Array.from({length:5},(_,index)=>{
    const value=Math.round(maxMinutes*(1-index/4)),y=plot.top+plot.height*index/4;
    return `<line class="weekly-chart-gridline" x1="${plot.left}" y1="${y}" x2="${plot.left+plot.width}" y2="${y}"></line><text class="weekly-chart-tick" x="${plot.left-7}" y="${y+4}" text-anchor="end">${value}</text>`;
  }).join("");
  const bars=buckets.map((bucket,index)=>{
    const height=bucket.minutes/maxMinutes*plot.height,x=plot.left+slotWidth*index+(slotWidth-barWidth)/2,y=plot.top+plot.height-height,center=x+barWidth/2;
    const showLabel=buckets.length<=14||index%Math.ceil(buckets.length/14)===0||index===buckets.length-1;
    return `<g><title>${escapeHtml(bucket.title)}: ${bucket.minutes} focus minutes</title><rect class="weekly-chart-bar" x="${x}" y="${y}" width="${barWidth}" height="${height}" rx="4"></rect>${bucket.minutes?`<text class="weekly-chart-value" x="${center}" y="${Math.max(plot.top+10,y-5)}" text-anchor="middle">${bucket.minutes}</text>`:""}${showLabel?`<text class="weekly-chart-day" x="${center}" y="${plot.top+plot.height+20}" text-anchor="middle">${escapeHtml(bucket.label)}</text>`:""}</g>`;
  }).join("");
  const linePoints=buckets.map((bucket,index)=>{
    const x=plot.left+slotWidth*index+slotWidth/2;
    const y=plot.top+plot.height-(bucket.minutes/maxMinutes*plot.height);
    return{x,y,bucket,index};
  });
  const trendLine=linePoints.map((point,index)=>`${index?"L":"M"} ${point.x} ${point.y}`).join(" ");
  const trendPoints=linePoints.map(point=>`<circle class="progress-chart-point" cx="${point.x}" cy="${point.y}" r="3"><title>${escapeHtml(point.bucket.title)}: ${point.bucket.minutes} focus minutes</title></circle>`).join("");
  const barChart=$("#rangeBarChart");
  barChart.setAttribute("aria-label",`Focus minutes by day from ${data.progressStartDate} to ${data.progressEndDate}.`);
  barChart.innerHTML=`<svg viewBox="0 0 490 216" role="img" aria-label="Daily focus minutes; vertical axis is minutes and horizontal axis is date">${grid}<line class="weekly-chart-axis-line" x1="${plot.left}" y1="${plot.top}" x2="${plot.left}" y2="${plot.top+plot.height}"></line><line class="weekly-chart-axis-line" x1="${plot.left}" y1="${plot.top+plot.height}" x2="${plot.left+plot.width}" y2="${plot.top+plot.height}"></line>${bars}<path class="progress-chart-trend" d="${trendLine}"></path>${trendPoints}</svg>`;
  const pie=$("#rangePieChart");
  pie.style.setProperty("--range-study-percent",`${percentage}%`);
  pie.setAttribute("aria-label",`${activeDays} of ${totalDays} days had focus activity`);
  $("#rangePiePercent").textContent=`${percentage}%`;
  $("#rangePieSummary").textContent=`${activeDays} of ${totalDays} days`;
}
function renderTaskBreakdowns(startDate,endDate){
  const subjects=new Map(),groups=new Map();
  data.groups.forEach(group=>groups.set(group.id,{name:group.name,subject:group.subject||"Unspecified subject",total:0,completed:0}));
  data.tasks.forEach(task=>{
    const taskGroup=task.groupId?data.groups.find(item=>item.id===task.groupId):null;
    const subject=taskGroup?.subject||"Uncategorized";
    if(!subjects.has(subject))subjects.set(subject,{total:0,completed:0,inRange:0});
    subjects.get(subject).total++;
    if(task.groupId&&groups.has(task.groupId))groups.get(task.groupId).total++;
    if(!task.done)return;
    subjects.get(subject).completed++;
    if(!task.completedAt)return;
    const completedDate=dateKey(new Date(task.completedAt));
    if(completedDate<startDate||completedDate>endDate)return;
    subjects.get(subject).inRange++;
    if(taskGroup&&groups.has(taskGroup.id))groups.get(taskGroup.id).completed++;
  });
  const subjectEntries=[...subjects.entries()].sort((a,b)=>b[1].inRange-a[1].inRange||b[1].completed-a[1].completed);
  $("#subjectProgressList").innerHTML=subjectEntries.length?subjectEntries.map(([subject,progress])=>`<div class="analysis-breakdown-row"><span>${escapeHtml(subject)} <small>${progress.total?Math.round(progress.completed/progress.total*100):0}% of all tasks complete</small></span><strong>${progress.inRange} in range · ${progress.completed}/${progress.total} complete</strong></div>`).join(""):'<p class="analysis-breakdown-empty">No tasks to report yet.</p>';
  const groupEntries=[...groups.values()].sort((a,b)=>a.name.localeCompare(b.name));
  $("#groupProgressList").innerHTML=groupEntries.length?groupEntries.map(group=>`<div class="analysis-breakdown-row"><span>${escapeHtml(group.name)} <small>${escapeHtml(group.subject)}</small></span><strong>${group.completed} completed · ${group.total} total</strong></div>`).join(""):'<p class="analysis-breakdown-empty">Join a study group to see group task statistics.</p>';
}
function downloadProgressReport(){
  const startDate=data.progressStartDate,endDate=data.progressEndDate;
  const start=new Date(`${startDate}T00:00:00`),end=new Date(`${endDate}T00:00:00`);
  const inRangeSessions=data.studyHistory.filter(session=>{
    if(studyHistoryLoadedUserId&&session.userId!==studyHistoryLoadedUserId)return false;
    const key=dateKey(new Date(session.completedAt));
    return key>=startDate&&key<=endDate;
  });
  const inRangeTasks=data.tasks.filter(task=>task.done&&task.completedAt&&dateKey(new Date(task.completedAt))>=startDate&&dateKey(new Date(task.completedAt))<=endDate);
  const focusByDate=new Map();
  inRangeSessions.forEach(session=>{const key=dateKey(new Date(session.completedAt));focusByDate.set(key,(focusByDate.get(key)||0)+Number(session.minutes||0))});
  if(!studyHistoryLoadedUserId)Object.entries(data.studyLog).forEach(([key,minutes])=>{if(key>=startDate&&key<=endDate)focusByDate.set(key,Math.max(focusByDate.get(key)||0,Number(minutes)||0))});
  const taskSubjects=new Map();
  inRangeTasks.forEach(task=>{const group=data.groups.find(item=>item.id===task.groupId);const subject=group?.subject||"Uncategorized";taskSubjects.set(subject,(taskSubjects.get(subject)||0)+1)});
  const activeGoals=[data.dailyGoalText&&data.dailyGoalDate===dateKey(new Date())?data.dailyGoalCompleted:null,data.weeklyGoalText&&data.weeklyGoalWeekStart===weekStartKey()?data.weeklyGoalCompleted:null].filter(value=>value!==null);
  const completedGoals=activeGoals.filter(Boolean).length,goalPercent=activeGoals.length?Math.round(completedGoals/activeGoals.length*100):0;
  const periodMinutes=(from,to)=>{const daily=new Map();for(const session of data.studyHistory){if(studyHistoryLoadedUserId&&session.userId!==studyHistoryLoadedUserId)continue;const key=dateKey(new Date(session.completedAt));if(key>=from&&key<=to)daily.set(key,(daily.get(key)||0)+Number(session.minutes||0))}if(!studyHistoryLoadedUserId)Object.entries(data.studyLog).forEach(([key,value])=>{if(key>=from&&key<=to)daily.set(key,Math.max(daily.get(key)||0,Number(value)||0))});return[...daily.values()].reduce((sum,value)=>sum+value,0)};
  const currentDate=new Date(),currentToday=dateKey(currentDate),monday=new Date(currentDate);monday.setHours(0,0,0,0);monday.setDate(monday.getDate()-((monday.getDay()+6)%7));
  const monthFirst=dateKey(new Date(currentDate.getFullYear(),currentDate.getMonth(),1));
  const lines=[
    "FocusTogether Personal Progress Report",
    `Date range: ${start.toLocaleDateString()} - ${end.toLocaleDateString()}`,
    `Study time: ${[...focusByDate.values()].reduce((sum,minutes)=>sum+minutes,0)} minutes`,
    `Focus sessions: ${inRangeSessions.length}`,
    `Completed tasks: ${inRangeTasks.length}`,
    `Today study time: ${getStudyMinutesForDate(currentToday)} minutes`,
    `This week study time: ${periodMinutes(dateKey(monday),currentToday)} minutes`,
    `This month study time: ${periodMinutes(monthFirst,currentToday)} minutes`,
    `Current goal completion: ${goalPercent}% (${completedGoals} of ${activeGoals.length} active goals)`,
    `Current study streak: ${$("#studyStreakStat").textContent}`,
    `Daily goal: ${data.dailyGoalText||"Not set"} (${data.dailyGoalCompleted?"Complete":"Incomplete"})`,
    `Weekly goal: ${data.weeklyGoalText||"Not set"} (${data.weeklyGoalCompleted?"Complete":"Incomplete"})`,
    "Completed tasks by subject:",
    ...(taskSubjects.size?[...taskSubjects].sort((a,b)=>b[1]-a[1]).map(([subject,count])=>`- ${subject}: ${count}`):["- None in this date range"]),
    "Daily focus minutes:",
    ...[...focusByDate].sort((a,b)=>a[0].localeCompare(b[0])).map(([date,minutes])=>`- ${date}: ${minutes} minutes`)
  ];
  const blob=new Blob([lines.join("\n")],{type:"text/plain;charset=utf-8"}),url=URL.createObjectURL(blob),link=document.createElement("a");
  link.href=url;link.download=`focustogether-progress-${startDate}-to-${endDate}.txt`;link.click();setTimeout(()=>URL.revokeObjectURL(url),0);
}
function renderDashboard(){const future=data.sessions.filter(s=>new Date(`${s.date}T${s.time}`)>=new Date()).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)).slice(0,3);$("#upcomingList").classList.toggle("empty-state",!future.length);$("#upcomingList").innerHTML=future.length?future.map(s=>`<div class="session-item"><div class="date-chip"><strong>${new Date(s.date+"T12:00").getDate()}</strong>${new Date(s.date+"T12:00").toLocaleDateString(undefined,{month:"short"}).toUpperCase()}</div><div class="item-main"><strong>${escapeHtml(s.title)}</strong><small>${escapeHtml(groupName(s.groupId))} · ${escapeHtml(s.time)}</small></div><button class="item-action" data-call="${s.id}" title="Open study room">↗</button></div>`).join(""):"No sessions scheduled yet.<br/>Add one to get started.";$("#taskPreview").classList.toggle("empty-state",!data.tasks.length);const tasks=data.tasks.filter(t=>!t.done).slice(0,4);$("#taskPreview").innerHTML=tasks.length?tasks.map(t=>`<div class="task-item"><input type="checkbox" data-task="${t.id}" aria-label="Complete task"/><div class="item-main"><strong>${escapeHtml(t.title)}</strong><small>${escapeHtml(groupName(t.groupId))}${t.shared?" · Shared":""}${t.due?" · Due "+escapeHtml(t.due):""}</small></div></div>`).join(""):data.tasks.length?"All tasks completed. Great work!":"No tasks yet. Create a group and add your first task.";wireDynamic()}
function renderGroups(){const el=$("#groupsGrid");el.innerHTML=data.groups.length?data.groups.map(g=>`<article class="group-card"><div class="group-icon">♧</div><h3>${escapeHtml(g.name)}</h3><p>${escapeHtml(g.subject)}${g.description?" · "+escapeHtml(g.description):""}</p><div class="group-meta"><span>♧ ${data.tasks.filter(t=>t.groupId===g.id).length} tasks</span><span>◉ ${data.notes.filter(n=>n.groupId===g.id).length} resources</span><span>Invite <b class="group-code">${g.code}</b></span></div><div class="group-actions"><button class="secondary-button" data-chat="${g.id}">Chat</button><button class="secondary-button" data-group-resources="${g.id}">Resources</button><button class="secondary-button" data-shared-timer="${g.id}">Shared timer</button><button class="secondary-button" data-whiteboard="${g.id}">Whiteboard</button>${g.role==="owner"?`<button class="outline-button" data-manage-group="${g.id}">Manage</button>`:""}<button class="secondary-button" data-addtask="${g.id}">＋ Task</button><button class="secondary-button" data-addnote="${g.id}">＋ Note</button><button class="outline-button" data-copy="${g.code}">Copy code</button><button class="secondary-button" data-room="${g.id}">Room ↗</button></div></article>`).join(""):`<div class="panel empty-state" style="grid-column:1/-1">No study groups yet.<br/>Create your first group for a subject or study goal.</div>`;wireDynamic()}
function renderSessions(){const list=[...data.sessions].sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));$("#sessionsList").classList.toggle("empty-state",!list.length);$("#sessionsList").innerHTML=list.length?list.map(s=>`<div class="session-item"><div class="date-chip"><strong>${new Date(s.date+"T12:00").getDate()}</strong>${new Date(s.date+"T12:00").toLocaleDateString(undefined,{month:"short"}).toUpperCase()}</div><div class="item-main"><strong>${escapeHtml(s.title)}</strong><small>${escapeHtml(groupName(s.groupId))} · ${escapeHtml(s.time)} · Reminder ${s.reminder===0?"at start":s.reminder+" min before"}</small></div><button class="outline-button" data-room="${s.groupId}">Join room</button><button class="item-action" data-delete-session="${s.id}" title="Delete session">×</button></div>`).join(""):"No sessions scheduled yet.";wireDynamic()}
const resourceImageUrlCache=new Map();
let resourceNotesRenderVersion=0;
async function loadResourceImageThumbnail(note,preview,renderVersion){
  try{
    const cacheKey=`${note.cloudBucket}:${note.cloudPath}`;
    let cached=resourceImageUrlCache.get(cacheKey);
    if(!cached||cached.expiresAt<=Date.now()){
      const client=getSupabaseClient();
      if(!client)throw new Error("Sign in to view this image.");
      const {data,error}=await client.storage.from(note.cloudBucket).createSignedUrl(note.cloudPath,300);
      if(error)throw error;
      cached={url:data.signedUrl,expiresAt:Date.now()+240000};
      resourceImageUrlCache.set(cacheKey,cached);
    }
    if(renderVersion!==resourceNotesRenderVersion||!preview.isConnected)return;
    const image=document.createElement("img");
    image.src=cached.url;
    image.alt=note.title;
    image.onerror=()=>{preview.textContent="Image preview unavailable"};
    preview.replaceChildren(image);
  }catch(error){
    console.error("Unable to load resource image preview:",error);
    if(renderVersion===resourceNotesRenderVersion&&preview.isConnected)preview.textContent="Image preview unavailable";
  }
}
function renderNotes(){
  const renderVersion=++resourceNotesRenderVersion;
  const el=$("#notesGrid");
  if(!el)return;
  const library=$("#resourceGroupFilter")?.value||"all",folder=$("#resourceFolderFilter")?.value||"all",search=($("#resourceSearch")?.value||"").trim().toLowerCase();
  const notes=data.notes.filter(note=>{
    if(library==="personal"&&note.groupId)return false;
    if(library!=="all"&&library!=="personal"&&note.groupId!==library)return false;
    if(folder!=="all"&&(folder.startsWith("name:")?(note.folderName||"General")!==folder.slice(5):(note.folderId||"")!==folder))return false;
    return !search||`${note.title} ${note.content} ${note.fileName} ${note.folderName}`.toLowerCase().includes(search);
  }).slice().reverse();
  el.innerHTML=notes.length?notes.map(note=>{
    const isImage=note.type?.startsWith("image/");
    const preview=note.dataUrl&&isImage?`<img src="${note.dataUrl}" alt="${escapeHtml(note.title)}"/>`:isImage?`<div class="file-preview" data-resource-image="${escapeHtml(note.id)}">${note.cloudBucket&&note.cloudPath?"Loading image…":"Image preview unavailable"}</div>`:`<div class="file-preview">${note.type?.includes("pdf")?"PDF":note.content?"NOTE":"FILE"}</div>`;
    const location=note.shared?groupName(note.groupId):"Personal library";
    return `<article class="note-card"><div class="note-card-preview">${preview}</div><div class="note-card-meta"><span class="resource-type">${note.content&&!note.fileName?"NOTE":escapeHtml((note.type?.split("/").pop()||"file").toUpperCase())}</span><span class="resource-location">${escapeHtml(location)}</span></div><h3>${escapeHtml(note.title)}</h3><p class="note-content">${escapeHtml(note.content||note.fileName||"Study resource")}</p><div class="note-date"><span>${escapeHtml(note.folderName||"General")}</span><span>${escapeHtml(note.date||"Saved locally")}</span>${note.fileName?`<span>${escapeHtml(note.fileName)}</span>`:""}</div><div class="note-card-actions"><button class="text-button" data-view-note="${note.id}">Open</button><button class="text-button" data-download-note="${note.id}">Download</button><button class="text-button" data-delete-note="${note.id}">Delete</button></div></article>`;
  }).join(""):`<div class="notes-empty panel"><strong>${data.notes.length?"No resources match these filters":"Your library is ready for its first resource."}</strong><p>${data.notes.length?"Try another library, folder, or search.":"Add a note or upload a PDF or image to get started."}</p></div>`;
  el.querySelectorAll("[data-resource-image]").forEach(preview=>{
    const note=notes.find(item=>item.id===preview.dataset.resourceImage);
    if(note?.cloudBucket&&note.cloudPath)loadResourceImageThumbnail(note,preview,renderVersion);
  });
  renderResourceFolderOptions();
}
function renderResourceFolderOptions(){
  const groupValue=id=>id||"";
  const library=$("#resourceGroupFilter"),folderFilter=$("#resourceFolderFilter"),folderGroup=$("#resourceFolderGroup");
  if(library){const old=library.value;library.innerHTML='<option value="all">All libraries</option><option value="personal">Personal library</option>'+data.groups.map(group=>`<option value="${group.id}">${escapeHtml(group.name)}</option>`).join("");library.value=[...library.options].some(option=>option.value===old)?old:"all"}
  if(folderGroup){const old=folderGroup.value;folderGroup.innerHTML='<option value="">Personal library</option>'+data.groups.map(group=>`<option value="${group.id}">${escapeHtml(group.name)}</option>`).join("");folderGroup.value=[...folderGroup.options].some(option=>option.value===old)?old:""}
  const selectors=[
    {element:$("#noteFolder"),groupId:$("#noteGroup")?.value||"",placeholder:"General folder"},
    {element:$("#fileFolderSelect"),groupId:$("#fileGroupSelect")?.value||"",placeholder:"General folder"},
    {element:folderFilter,groupId:library?.value&&library.value!=="all"&&library.value!=="personal"?library.value:"",placeholder:"All folders"}
  ];
  selectors.forEach(({element,groupId,placeholder})=>{
    if(!element)return;
    const old=element.value,folders=data.resourceFolders.filter(folder=>(folder.groupId||"")===groupValue(groupId));
    if(element===folderFilter&&library?.value==="all"){
      element.innerHTML='<option value="all">All folders</option>'+[...new Set(data.notes.map(note=>note.folderName||"General"))].sort().map(name=>`<option value="name:${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
      if([...element.options].some(option=>option.value===old))element.value=old;
      return;
    }
    element.innerHTML=`<option value="${placeholder==="All folders"?"all":""}">${placeholder}</option>`+folders.map(folder=>`<option value="${folder.id}">${escapeHtml(folder.name)}</option>`).join("");
    element.value=[...element.options].some(option=>option.value===old)?old:element.options[0].value;
  });
}
async function downloadNote(noteId){const note=data.notes.find(item=>item.id===noteId);if(!note)return;const fileName=note.fileName||`${note.title.replace(/[\\/:*?"<>|]/g,"_")}.txt`;let blob;if(note.dataUrl){const response=await fetch(note.dataUrl);if(!response.ok)throw new Error("Unable to read the saved file.");blob=await response.blob()}else if(note.cloudBucket&&note.cloudPath){const client=getSupabaseClient();if(!client)throw new Error("Please log in to download this cloud file.");const {data: fileData,error}=await client.storage.from(note.cloudBucket).download(note.cloudPath);if(error)throw error;blob=fileData}else if(note.content){blob=new Blob([note.content],{type:note.type||"text/plain;charset=utf-8"})}else{throw new Error("This resource has no saved file data. Upload it again to download it.")}const url=URL.createObjectURL(blob);const link=document.createElement("a");link.href=url;link.download=fileName;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
let activeNoteViewerId="";
function renderNoteComments(comments){
  const list=$("#noteCommentsList");
  $("#noteCommentCount").textContent=String(comments.length);
  list.innerHTML=comments.length?comments.map(comment=>{
    const author=!comment.created_by||comment.created_by===friendPresenceUserId?data.name||"You":studyFriends.find(friend=>friend.userId===comment.created_by)?.name||"Study member";
    return `<article class="note-comment"><div><strong>${escapeHtml(author)}</strong><time>${escapeHtml(new Date(comment.created_at).toLocaleString())}</time></div><p>${escapeHtml(comment.comment)}</p></article>`;
  }).join(""):'<p class="note-comments-empty">No comments yet. Start the discussion.</p>';
}
async function loadNoteComments(note){
  if(note.shared){
    const client=getSupabaseClient();
    if(!client)throw new Error("Sign in to load shared-note comments.");
    const {data:comments,error}=await client.from("study_group_note_comments").select("id,group_id,note_id,created_by,comment,created_at").eq("note_id",note.id).order("created_at",{ascending:true}).limit(100);
    if(error)throw error;
    renderNoteComments(comments||[]);
    return;
  }
  renderNoteComments(note.comments||[]);
}
async function viewNote(noteId){
  const note=data.notes.find(item=>item.id===noteId);
  if(!note)return;
  activeNoteViewerId=noteId;
  $("#noteViewerTitle").textContent=note.title;
  const content=$("#noteViewerContent");
  content.textContent="Loading resource…";
  $("#noteCommentsList").textContent="Loading comments…";
  openDialog("noteViewerDialog");
  try{
    if(note.dataUrl&&note.type?.startsWith("image/"))content.innerHTML=`<img class="note-view-image" src="${note.dataUrl}" alt="${escapeHtml(note.title)}"/>`;
    else if(note.dataUrl&&note.type==="application/pdf")content.innerHTML=`<iframe class="note-view-frame" src="${note.dataUrl}" title="${escapeHtml(note.title)}"></iframe>`;
    else if(note.cloudBucket&&note.cloudPath){
      const client=getSupabaseClient();
      if(!client)throw new Error("Sign in to view this cloud file.");
      const {data:signedUrlData,error}=await client.storage.from(note.cloudBucket).createSignedUrl(note.cloudPath,300);
      if(error)throw error;
      if(note.type?.includes("pdf"))content.innerHTML=`<iframe class="note-view-frame" src="${escapeHtml(signedUrlData.signedUrl)}" title="${escapeHtml(note.title)}"></iframe>`;
      else if(note.type?.startsWith("image/"))content.innerHTML=`<img class="note-view-image" src="${escapeHtml(signedUrlData.signedUrl)}" alt="${escapeHtml(note.title)}"/>`;
      else content.innerHTML=`<p>This file is stored securely in the study library.</p><a class="primary-button" href="${escapeHtml(signedUrlData.signedUrl)}" target="_blank" rel="noopener">Open ${escapeHtml(note.fileName||"file")}</a>`;
      if(note.content)content.insertAdjacentHTML("beforeend",`<pre class="note-view-text">${escapeHtml(note.content)}</pre>`);
    }else if(note.content)content.innerHTML=`<pre class="note-view-text">${escapeHtml(note.content)}</pre>`;
    else content.textContent="This resource has no saved file data. Upload it again to preview it.";
  }catch(error){
    console.error("Unable to open study resource:",error);
    content.textContent=error.message||"Could not open this resource. Check your login and storage access policies.";
  }
  try{await loadNoteComments(note)}catch(error){console.error("Unable to load note comments:",error);$("#noteCommentsList").textContent="Comments could not be loaded: "+(error.message||"Please try again.")}
}
function groupName(id){return data.groups.find(g=>g.id===id)?.name||"Personal study"}
function getSupabaseClient(){return window.focusTogetherSupabase?.getClient?window.focusTogetherSupabase.getClient():null}
async function getCurrentUserId(){return window.focusTogetherSupabase?.getSessionUserId?await window.focusTogetherSupabase.getSessionUserId():null}
let groupSyncPromise=null;
async function loadSharedGroupContent(){
  const client=getSupabaseClient();
  if(!client)return;
  const groupIds=data.groups.map(group=>group.id);
  const localFolders=data.resourceFolders.filter(folder=>!folder.shared);
  if(!groupIds.length){
    data.tasks=data.tasks.filter(task=>!task.shared);
    data.notes=data.notes.filter(note=>!note.shared);
    data.resourceFolders=localFolders;
    return;
  }
  const [tasksResult,notesResult,foldersResult]=await Promise.all([
    client.from("study_group_tasks").select("id,group_id,created_by,title,due,done,completed_at").in("group_id",groupIds),
    client.from("study_group_notes").select("id,group_id,created_by,title,content,file_name,mime_type,storage_bucket,storage_path,folder_id,created_at").in("group_id",groupIds),
    client.from("study_group_resource_folders").select("id,group_id,name,created_by,created_at").in("group_id",groupIds).order("name")
  ]);
  if(tasksResult.error)throw tasksResult.error;
  if(notesResult.error)throw notesResult.error;
  if(foldersResult.error)throw foldersResult.error;
  const sharedFolders=(foldersResult.data||[]).map(folder=>({id:folder.id,groupId:folder.group_id,name:folder.name,createdBy:folder.created_by,shared:true}));
  const foldersById=new Map(sharedFolders.map(folder=>[folder.id,folder]));
  data.resourceFolders=[...localFolders,...sharedFolders];
  data.tasks=[...data.tasks.filter(task=>!task.shared),...(tasksResult.data||[]).map(task=>({id:task.id,title:task.title,groupId:task.group_id,due:task.due||"",done:task.done,completedAt:task.completed_at,shared:true,createdBy:task.created_by}))];
  data.notes=[...data.notes.filter(note=>!note.shared),...(notesResult.data||[]).map(note=>({id:note.id,title:note.title,content:note.content||"",fileName:note.file_name||"",type:note.mime_type||"text/plain",date:new Date(note.created_at).toLocaleDateString(),groupId:note.group_id,folderId:note.folder_id||"",folderName:foldersById.get(note.folder_id)?.name||"General",shared:true,createdBy:note.created_by,cloudBucket:note.storage_bucket,cloudPath:note.storage_path}))];
}
async function loadMyStudyProfile(userId){
  const client=getSupabaseClient();
  if(!client)throw new Error("Supabase is unavailable.");
  const {data:profile,error}=await client.from("study_member_profiles").select("display_name,bio,profile_photo,friend_uid").eq("user_id",userId).maybeSingle();
  if(error)throw new Error(`Could not load your saved profile: ${error.message}`);
  if(!profile){await syncMyStudyProfile(userId);return}
  data.name=profile.display_name||"Student";
  data.bio=profile.bio||"";
  data.avatarDataUrl=profile.profile_photo||"";
  myFriendUid=profile.friend_uid;
  syncedProfileUserId=userId;
  syncedProfileName=data.name;
  syncedProfilePhoto=data.avatarDataUrl;
  syncedProfileBio=data.bio;
  localStorage.setItem(STORAGE_KEY,JSON.stringify(data));
  updateProfileUI();
  $("#myFriendUid").textContent=myFriendUid||"Unavailable";
  $("#profileFriendUid").textContent=myFriendUid||"Unavailable";
}
async function syncMyStudyProfile(userId){
  if(!userId||myFriendUid&&syncedProfileUserId===userId&&syncedProfileName===data.name&&syncedProfilePhoto===data.avatarDataUrl&&syncedProfileBio===data.bio)return;
  const client=getSupabaseClient();
  if(!client)throw new Error("Supabase is unavailable.");
  $("#myFriendUid").textContent="Loading…";
  $("#profileFriendUid").textContent="Loading…";
  const {data:profile,error}=await client.from("study_member_profiles").upsert({
    user_id:userId,
    display_name:(data.name||"Student").trim().slice(0,40),
    bio:(data.bio||"").trim().slice(0,160),
    profile_photo:data.avatarDataUrl||null,
    updated_at:new Date().toISOString()
  },{onConflict:"user_id"}).select("friend_uid").single();
  if(error){
    $("#myFriendUid").textContent="Unavailable";
    $("#profileFriendUid").textContent="Unavailable";
    throw new Error(`Could not load your friend UID: ${error.message}`);
  }
  if(!profile?.friend_uid){
    $("#myFriendUid").textContent="Unavailable";
    $("#profileFriendUid").textContent="Unavailable";
    throw new Error("Your profile did not return a friend UID. Re-run the latest groups.sql setup.");
  }
  myFriendUid=profile.friend_uid;
  $("#myFriendUid").textContent=myFriendUid;
  $("#profileFriendUid").textContent=myFriendUid;
  syncedProfileUserId=userId;
  syncedProfileName=data.name;
  syncedProfilePhoto=data.avatarDataUrl;
  syncedProfileBio=data.bio;
}
async function loadStudyFriends(client){
  const [groupResult,friendResult,requestResult]=await Promise.all([
    client.rpc("get_my_study_friends"),
    client.rpc("get_study_friends"),
    client.rpc("get_incoming_study_friend_requests")
  ]);
  if(groupResult.error)throw groupResult.error;
  if(friendResult.error)throw friendResult.error;
  if(requestResult.error)throw requestResult.error;
  const byUser=new Map();
  (groupResult.data||[]).forEach(friend=>{
    let entry=byUser.get(friend.user_id);
    if(!entry){entry={userId:friend.user_id,name:friend.display_name||"Study friend",friendUid:friend.friend_uid||"",photo:friend.profile_photo||"",groups:[]};byUser.set(friend.user_id,entry)}
    if(friend.group_name&&!entry.groups.includes(friend.group_name))entry.groups.push(friend.group_name);
    if(friend.friend_uid)entry.friendUid=friend.friend_uid;
    if(friend.profile_photo)entry.photo=friend.profile_photo;
  });
  (friendResult.data||[]).forEach(friend=>{
    let entry=byUser.get(friend.user_id);
    if(!entry){entry={userId:friend.user_id,name:friend.display_name||"Study friend",friendUid:friend.friend_uid||"",photo:friend.profile_photo||"",groups:[]};byUser.set(friend.user_id,entry)}
    entry.name=friend.display_name||entry.name;
    entry.friendUid=friend.friend_uid||entry.friendUid;
    entry.photo=friend.profile_photo||entry.photo;
  });
  studyFriends=[...byUser.values()].sort((a,b)=>a.name.localeCompare(b.name));
  incomingFriendRequests=(requestResult.data||[]).map(request=>({id:request.request_id,userId:request.user_id,name:request.display_name||"Study friend",friendUid:request.friend_uid||"",photo:request.profile_photo||""}));
}
function clearFriendPresence(){
  friendPresenceChannels.forEach(channel=>{const result=channel.unsubscribe();if(result?.catch)result.catch(error=>console.error("Unable to leave a study-friends presence channel:",error))});
  friendPresenceChannels.clear();friendPresenceUserId="";friendPresenceError=false;studyFriends=[];incomingFriendRequests=[];myFriendUid="";renderFriends();
}
function syncFriendPresence(client,userId){
  if(friendPresenceUserId!==userId){clearFriendPresence();friendPresenceUserId=userId}
  const desiredChannels=new Map();
  data.groups.forEach(group=>desiredChannels.set(`group:${group.id}`,{topic:`study-presence:${group.id}`,key:userId}));
  studyFriends.forEach(friend=>{
    const users=[userId,friend.userId].sort();
    const topic=`study-friend-presence:${users[0]}:${users[1]}`;
    desiredChannels.set(`friend:${friend.userId}`,{topic,key:userId});
  });
  friendPresenceChannels.forEach((channel,key)=>{
    if(!desiredChannels.has(key)){
      const result=channel.unsubscribe();
      if(result?.catch)result.catch(error=>console.error("Unable to leave a removed friends presence channel:",error));
      friendPresenceChannels.delete(key);
    }
  });
  desiredChannels.forEach(({topic,key:userKey},key)=>{
    if(friendPresenceChannels.has(key))return;
    const channel=client.channel(topic,{config:{private:true,presence:{key:userKey}}});
    friendPresenceChannels.set(key,channel);
    channel.on("presence",{event:"sync"},renderFriends);
    channel.subscribe(async status=>{
      if(status==="SUBSCRIBED"){
        friendPresenceError=false;
        try{await channel.track({display_name:data.name||"Student"});renderFriends()}
        catch(error){friendPresenceError=true;console.error("Unable to publish study-friends online status:",error);renderFriends()}
      }else if(status==="CHANNEL_ERROR"||status==="TIMED_OUT"||status==="CLOSED"){
        friendPresenceError=true;console.error(`Study-friends presence channel disconnected (${status}).`);renderFriends();
      }
    });
  });
  renderFriends();
}
async function loadMyGroups(){
  if(groupSyncPromise)return groupSyncPromise;
  groupSyncPromise=(async()=>{
    const client=getSupabaseClient();
    if(!client)return;
    const userId=await getCurrentUserId();
    if(!userId){clearFriendPresence();return}
    const {data:groups,error}=await client.rpc("get_my_study_groups");
    if(error)throw error;
    data.groups=(groups||[]).map(group=>({id:group.id,name:group.name,subject:group.subject,description:group.description,code:group.code,role:group.role}));
    await loadMyStudyProfile(userId);
    await loadStudyFriends(client);
    syncFriendPresence(client,userId);
    renderFriends();
    save();
    await Promise.all([loadSharedGroupContent(),loadStudyHistory(client,userId),loadDailyGoal(client,userId)]);
    save();
  })();
  try{await groupSyncPromise}finally{groupSyncPromise=null}
}
async function searchFriendByUid(friendUid){
  const results=$("#friendSearchResults");
  results.textContent="Searching…";
  try{
    const client=getSupabaseClient();
    if(!client)throw new Error("Supabase is unavailable.");
    const {data:matches,error}=await client.rpc("search_study_user",{p_friend_uid:friendUid.trim()});
    if(error)throw error;
    const match=matches?.[0];
    if(!match){results.textContent="No profile found for that UID.";return}
    const avatar=match.profile_photo?`<img src="${escapeHtml(match.profile_photo)}" alt="${escapeHtml(match.display_name)}'s profile photo"/>`:escapeHtml(match.display_name[0]?.toUpperCase()||"S");
    const action=match.relationship==="friends"?"Already friends":match.relationship==="sent"?"Request sent":match.relationship==="received"?"":'<button class="primary-button" data-send-friend="'+escapeHtml(match.friend_uid)+'">Add friend</button>';
    results.innerHTML=`<article class="friend-profile-result"><div class="friend-avatar">${avatar}</div><div class="friend-details"><strong>${escapeHtml(match.display_name)}</strong><small class="friend-uid-label">${escapeHtml(match.friend_uid)}</small></div>${action}</article>`;
    if(match.relationship==="received"){
      if(match.request_id)results.querySelector(".friend-profile-result").insertAdjacentHTML("beforeend",`<button class="primary-button" data-accept-friend="${escapeHtml(match.request_id)}">Accept request</button>`);
    }
  }catch(error){console.error("Friend UID search failed:",error);results.textContent=`Could not search friend UID: ${error.message||"Please try again."}`}
}
$("#friendSearchInput").addEventListener("input",event=>{event.target.value=event.target.value.toUpperCase().replace(/\s/g,"")});
$("#friendSearchForm").addEventListener("submit",event=>{event.preventDefault();searchFriendByUid($("#friendSearchInput").value)});
$("#copyFriendUidBtn").addEventListener("click",async()=>{
  if(!myFriendUid){showNotice("Your friend UID is still loading.");return}
  try{await navigator.clipboard.writeText(myFriendUid);showNotice("Friend UID copied.")}
  catch(error){console.error("Could not copy friend UID:",error);showNotice("Could not copy UID. Select and copy it manually.")}
});
$("#copyProfileFriendUidBtn").addEventListener("click",async()=>{
  if(!myFriendUid){showNotice("Your friend UID is still loading.");return}
  try{await navigator.clipboard.writeText(myFriendUid);showNotice("Friend UID copied.")}
  catch(error){console.error("Could not copy friend UID:",error);showNotice("Could not copy UID. Select and copy it manually.")}
});
async function respondToFriendRequest(requestId,accept){
  try{
    const client=getSupabaseClient();
    if(!client)throw new Error("Supabase is unavailable.");
    const {data:updated,error}=await client.rpc("respond_to_study_friend_request",{p_request_id:requestId,p_accept:accept});
    if(error)throw error;
    if(!updated)throw new Error("This friend request is no longer available.");
    await loadStudyFriends(client);
    syncFriendPresence(client,friendPresenceUserId);
    renderFriends();
    showNotice(accept?"Friend request accepted.":"Friend request ignored.");
  }catch(error){console.error("Could not respond to friend request:",error);showNotice(error.message||"Could not update friend request.")}
}
$("#friendSearchResults").addEventListener("click",async event=>{
  const accept=event.target.closest("[data-accept-friend]");
  if(accept){respondToFriendRequest(accept.dataset.acceptFriend,true);return}
  const button=event.target.closest("[data-send-friend]");
  if(!button)return;
  button.disabled=true;
  try{
    const client=getSupabaseClient();
    if(!client)throw new Error("Supabase is unavailable.");
    const {data:result,error}=await client.rpc("send_study_friend_request",{p_friend_uid:button.dataset.sendFriend});
    if(error)throw error;
    if(result==="received"){await loadStudyFriends(client);syncFriendPresence(client,friendPresenceUserId);renderFriends();await searchFriendByUid(button.dataset.sendFriend)}
    else await searchFriendByUid(button.dataset.sendFriend);
    showNotice(result==="friends"?"You are already friends.":"Friend request sent.");
  }catch(error){console.error("Could not send friend request:",error);button.disabled=false;showNotice(error.message||"Could not send friend request.")}
});
$("#incomingFriendRequests").addEventListener("click",event=>{
  const accept=event.target.closest("[data-accept-friend]");
  const decline=event.target.closest("[data-decline-friend]");
  if(accept)respondToFriendRequest(accept.dataset.acceptFriend,true);
  else if(decline)respondToFriendRequest(decline.dataset.declineFriend,false);
});
window.focusTogetherApp={loadGroups:loadMyGroups,clearPresence:clearFriendPresence};
function refreshSharedStudyState(){if(document.visibilityState!=="visible"||!getSupabaseClient())return;getCurrentUserId().then(userId=>userId?loadMyGroups():clearFriendPresence()).catch(error=>console.error("Unable to refresh shared group content:",error))}
setInterval(refreshSharedStudyState,20000);
document.addEventListener("visibilitychange",refreshSharedStudyState);
async function ensureGroupMembership(groupId){const client=getSupabaseClient();const userId=await getCurrentUserId();if(!client||!groupId||!userId)return false;const {data,error}=await client.from("group_members").select("id").eq("group_id",groupId).eq("user_id",userId).maybeSingle();if(error){console.error("group membership check failed:",error);return false}return !!data}
async function uploadToSupabaseStorage(file,{bucket,folder}={}){const client=getSupabaseClient();if(!client)return null;const userId=await getCurrentUserId();if(!userId){throw new Error("Please log in before uploading files.")}const targetBucket=bucket||"user-private";const targetFolder=folder||`users/${userId}`;const fileName=`${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;const path=`${targetFolder}/${fileName}`;const {error}=await client.storage.from(targetBucket).upload(path,file,{upsert:false,cacheControl:"3600"});if(error){throw error}return{bucket:targetBucket,path}}
function fillGroupSelects(){
  ["taskGroup","sessionGroup","noteGroup","fileGroupSelect"].forEach(id=>{
    const element=$("#"+id);
    if(!element)return;
    const old=element.value;
    element.innerHTML='<option value="">Personal library</option>'+data.groups.map(group=>`<option value="${group.id}">${escapeHtml(group.name)}</option>`).join("");
    if([...element.options].some(option=>option.value===old))element.value=old;
  });
  renderResourceFolderOptions();
}
async function createResourceFolder(groupId,name){
  const cleanName=name.trim();
  if(!cleanName||cleanName.length>60)throw new Error("Folder names must be between 1 and 60 characters.");
  if(data.resourceFolders.some(folder=>(folder.groupId||"")===groupId&&folder.name.toLowerCase()===cleanName.toLowerCase()))throw new Error("A folder with that name already exists in this library.");
  let folder;
  if(groupId){
    const client=getSupabaseClient(),userId=await getCurrentUserId();
    if(!client||!userId)throw new Error("Sign in to create a shared group folder.");
    const {data:created,error}=await client.from("study_group_resource_folders").insert({group_id:groupId,created_by:userId,name:cleanName}).select("id,group_id,name,created_by").single();
    if(error)throw error;
    folder={id:created.id,groupId:created.group_id,name:created.name,createdBy:created.created_by,shared:true};
  }else folder={id:uid(),groupId:"",name:cleanName,shared:false};
  data.resourceFolders.push(folder);
  localStorage.setItem(STORAGE_KEY,JSON.stringify(data));
  renderNotes();
  return folder;
}
function folderFor(groupId,folderId){
  if(!folderId)return{id:"",name:"General"};
  const folder=data.resourceFolders.find(item=>item.id===folderId&&(item.groupId||"")===groupId);
  if(!folder)throw new Error("Choose a folder from the selected library.");
  return{id:folder.id,name:folder.name};
}
function openGroupCall(groupId){const group=data.groups.find(item=>item.id===groupId);if(!group){showNotice("Join the group before opening its call room.");return}liveKitRoomDisplayName=group.name;$("#callRoomCode").value=group.code;$("#callRoomName").textContent=group.name;$("#callRoomCodeLabel").textContent=group.code;openDialog("callDialog")}
async function removeNote(noteId){const note=data.notes.find(item=>item.id===noteId);if(!note)return;if(note.shared){const client=getSupabaseClient();if(!client)throw new Error("Sign in to remove a shared resource.");const {error}=await client.from("study_group_notes").delete().eq("id",noteId).select("id").single();if(error)throw error;if(note.cloudBucket&&note.cloudPath){const {error:storageError}=await client.storage.from(note.cloudBucket).remove([note.cloudPath]);if(storageError){console.error("Shared note was deleted but its file could not be removed:",storageError);showNotice("Note deleted, but its stored file could not be removed.")}}}data.notes=data.notes.filter(item=>item.id!==noteId);save()}
let activeGroupChatId="", groupChatRefreshTimer=null;
function renderGroupMessages(messages){const currentUserId=friendPresenceUserId,ordered=[...messages].sort((a,b)=>Number(b.is_announcement)-Number(a.is_announcement)||a.created_at.localeCompare(b.created_at)),box=$("#groupChatMessages");box.innerHTML=ordered.length?ordered.map(message=>{const author=message.created_by===currentUserId?data.name:studyFriends.find(friend=>friend.userId===message.created_by)?.name||"Study friend";const createdAt=new Date(message.created_at);return `<article class="group-chat-message${message.is_announcement?" is-announcement":""}"><header><strong>${escapeHtml(author)}${message.is_announcement?" · Pinned announcement":""}</strong><time>${escapeHtml(createdAt.toLocaleString())}</time></header><p>${escapeHtml(message.message)}</p></article>`}).join(""):'<div class="friends-empty">No messages yet. Start the group conversation.</div>';box.scrollTop=box.scrollHeight}
async function loadGroupMessages(){if(!activeGroupChatId)return;const client=getSupabaseClient();if(!client)throw new Error("Supabase is unavailable.");const {data:messages,error}=await client.from("study_group_messages").select("id,group_id,created_by,message,is_announcement,created_at").eq("group_id",activeGroupChatId).order("created_at",{ascending:false}).limit(100);if(error)throw error;renderGroupMessages([...(messages||[])].reverse())}
async function openGroupChat(groupId){const group=data.groups.find(item=>item.id===groupId);if(!group){showNotice("Join this group before opening its chat.");return}try{const client=getSupabaseClient(),userId=await getCurrentUserId();if(!client||!userId)throw new Error("Sign in to use group chat.");activeGroupChatId=groupId;friendPresenceUserId=userId;$("#groupChatTitle").textContent=group.name+" chat";$("#announcementOption").classList.toggle("hidden",group.role!=="owner");$("#groupChatAnnouncement").checked=false;openDialog("groupChatDialog");await loadGroupMessages();clearInterval(groupChatRefreshTimer);groupChatRefreshTimer=setInterval(()=>loadGroupMessages().catch(error=>{console.error("Unable to refresh group chat:",error)}),6000)}catch(error){stopGroupChatRefresh();if($("#groupChatDialog").open)closeDialog("groupChatDialog");console.error("Unable to open group chat:",error);showNotice(error.message||"Could not open group chat.")}}
$("#groupsGrid").addEventListener("click",event=>{const button=event.target.closest("[data-chat]");if(button)openGroupChat(button.dataset.chat)});
$("#groupsGrid").addEventListener("click",event=>{const button=event.target.closest("[data-group-resources]");if(button){showView("notes");$("#resourceGroupFilter").value=button.dataset.groupResources;renderResourceFolderOptions();renderNotes();return}if(event.target.closest("[data-addnote]"))renderResourceFolderOptions()});
let managedGroupId="";
async function loadGroupManagement(){const client=getSupabaseClient();if(!client||!managedGroupId)throw new Error("Supabase is unavailable.");const {data:members,error}=await client.rpc("get_study_group_management",{p_group_id:managedGroupId});if(error)throw error;const rows=members||[];if(!rows.length)throw new Error("Group management returned no members.");const settings=rows[0];$("#membersCanUpload").checked=settings.members_can_upload;$("#membersCanViewFiles").checked=settings.members_can_view_files;$("#membersCanDeleteFiles").checked=settings.members_can_delete_files;$("#groupMembersList").innerHTML=rows.map(member=>`<div class="group-member-row"><div><strong>${escapeHtml(member.display_name||"Study friend")}</strong><small>${escapeHtml(member.role)}${member.joined_at?` · Joined ${escapeHtml(new Date(member.joined_at).toLocaleDateString())}`:""}</small></div>${member.role!=="owner"?`<button class="text-button" type="button" data-remove-member="${member.user_id}">Remove</button>`:""}</div>`).join("");$("#groupManagementStatus").textContent="";$("#groupManagementStatus").classList.add("hidden")}
async function openGroupManagement(groupId){const group=data.groups.find(item=>item.id===groupId);if(!group||group.role!=="owner"){showNotice("Only the group owner can manage members and file access.");return}managedGroupId=groupId;$("#groupManagementTitle").textContent=group.name+" settings";$("#groupManagementStatus").textContent="";$("#groupManagementStatus").classList.add("hidden");$("#groupMembersList").textContent="Loading group settings…";openDialog("groupManagementDialog");try{await loadGroupManagement()}catch(error){console.error("Unable to load group settings:",error);$("#groupManagementStatus").textContent=`Could not load group settings: ${error.message||"Check the Supabase group setup."}`;$("#groupManagementStatus").classList.remove("hidden");$("#groupMembersList").textContent="Group members could not be loaded."}}
$("#groupsGrid").addEventListener("click",event=>{const button=event.target.closest("[data-manage-group]");if(button)openGroupManagement(button.dataset.manageGroup)});
$("#closeGroupManagementBtn").onclick=()=>{managedGroupId="";closeDialog("groupManagementDialog")};
$("#groupManagementDialog").addEventListener("close",()=>{managedGroupId=""});
$("#groupPermissionsForm").addEventListener("submit",async event=>{event.preventDefault();if(!managedGroupId)return;const client=getSupabaseClient();if(!client){showNotice("Supabase is unavailable.");return}const button=$("#groupPermissionsForm button[type='submit']");button.disabled=true;try{const {error}=await client.rpc("update_study_group_file_permissions",{p_group_id:managedGroupId,p_members_can_upload:$("#membersCanUpload").checked,p_members_can_view_files:$("#membersCanViewFiles").checked,p_members_can_delete_files:$("#membersCanDeleteFiles").checked});if(error)throw error;showNotice("Group file permissions updated.")}catch(error){console.error("Unable to update group file permissions:",error);showNotice(error.message||"Could not update permissions.")}finally{button.disabled=false}});
$("#groupMembersList").addEventListener("click",async event=>{const button=event.target.closest("[data-remove-member]");if(!button||!managedGroupId)return;if(!confirm("Remove this member from the study group? They will lose access to its shared resources."))return;button.disabled=true;try{const client=getSupabaseClient();if(!client)throw new Error("Supabase is unavailable.");const {error}=await client.rpc("remove_study_group_member",{p_group_id:managedGroupId,p_member_id:button.dataset.removeMember});if(error)throw error;await loadGroupManagement();await loadMyGroups();showNotice("Member removed from the group.")}catch(error){console.error("Unable to remove group member:",error);showNotice(error.message||"Could not remove this member.")}finally{button.disabled=false}});
let activeSharedTimerGroupId="", sharedTimerState={remaining_seconds:1500,is_running:false,is_break:false,started_at:null}, sharedTimerTick=null, sharedTimerRefresh=null;
function getSharedTimerRemaining(){if(!sharedTimerState.is_running||!sharedTimerState.started_at)return Math.max(0,sharedTimerState.remaining_seconds);return Math.max(0,sharedTimerState.remaining_seconds-Math.floor((Date.now()-new Date(sharedTimerState.started_at).getTime())/1000))}
function renderSharedTimer(){const remaining=getSharedTimerRemaining(),minutes=Math.floor(remaining/60),secondsLeft=remaining%60;$("#sharedTimerCountdown").textContent=`${String(minutes).padStart(2,"0")}:${String(secondsLeft).padStart(2,"0")}`;$("#sharedTimerMode").textContent=sharedTimerState.is_break?"BREAK TIME":"FOCUS SESSION";$("#sharedTimerStatus").textContent=remaining===0&&sharedTimerState.is_running?"Timer finished":sharedTimerState.is_running?"Group focus session in progress":sharedTimerState.is_break?"Ready for a group break":"Ready for your group";$("#sharedTimerStartBtn").textContent=sharedTimerState.is_running?"Pause":"Start"}
async function loadSharedTimer(){if(!activeSharedTimerGroupId)return;const client=getSupabaseClient();if(!client)throw new Error("Supabase is unavailable.");const {data:timer,error}=await client.from("study_group_timers").select("remaining_seconds,is_running,is_break,started_at").eq("group_id",activeSharedTimerGroupId).maybeSingle();if(error)throw error;sharedTimerState=timer||{remaining_seconds:1500,is_running:false,is_break:false,started_at:null};renderSharedTimer()}
async function saveSharedTimer(patch){const client=getSupabaseClient();if(!client||!await getCurrentUserId())throw new Error("Sign in to control the shared timer.");const state={remaining_seconds:1500,is_running:false,is_break:false,...sharedTimerState,...patch};const {data:timers,error}=await client.rpc("set_study_group_timer",{p_group_id:activeSharedTimerGroupId,p_remaining_seconds:state.remaining_seconds,p_is_running:state.is_running,p_is_break:state.is_break});if(error)throw error;const timer=Array.isArray(timers)?timers[0]:timers;if(!timer)throw new Error("The shared timer service returned no timer state.");sharedTimerState=timer;renderSharedTimer()}
async function openSharedTimer(groupId){const group=data.groups.find(item=>item.id===groupId);if(!group){showNotice("Join this group before opening its shared timer.");return}activeSharedTimerGroupId=groupId;$("#sharedTimerTitle").textContent=group.name+" shared timer";openDialog("sharedTimerDialog");try{await loadSharedTimer();sharedTimerTick=setInterval(renderSharedTimer,1000);sharedTimerRefresh=setInterval(()=>loadSharedTimer().catch(error=>{console.error("Unable to refresh shared focus timer:",error);$("#sharedTimerStatus").textContent="Connection lost. Reconnect to sync the timer."}),5000)}catch(error){stopSharedTimer();closeDialog("sharedTimerDialog");console.error("Unable to open shared focus timer:",error);showNotice(error.message||"Could not open shared timer.")}}
function stopSharedTimer(){clearInterval(sharedTimerTick);clearInterval(sharedTimerRefresh);sharedTimerTick=null;sharedTimerRefresh=null;activeSharedTimerGroupId=""}
$("#groupsGrid").addEventListener("click",event=>{const button=event.target.closest("[data-shared-timer]");if(button)openSharedTimer(button.dataset.sharedTimer)});
$("#closeSharedTimerBtn").onclick=()=>{stopSharedTimer();closeDialog("sharedTimerDialog")};
$("#sharedTimerDialog").addEventListener("close",stopSharedTimer);
$("#sharedTimerDialog").addEventListener("cancel",stopSharedTimer);
$("#sharedTimerStartBtn").onclick=async()=>{const remaining=getSharedTimerRemaining();const patch=sharedTimerState.is_running?{remaining_seconds:remaining,is_running:false,started_at:null}:{remaining_seconds:remaining,is_running:true,started_at:new Date().toISOString()};try{await saveSharedTimer(patch)}catch(error){console.error("Unable to update shared focus timer:",error);showNotice(error.message||"Could not update the shared timer.")}};
$("#sharedTimerResetBtn").onclick=async()=>{try{await saveSharedTimer({remaining_seconds:1500,is_running:false,is_break:false,started_at:null})}catch(error){console.error("Unable to reset shared focus timer:",error);showNotice(error.message||"Could not reset the shared timer.")}};
$("#sharedTimerBreakBtn").onclick=async()=>{try{await saveSharedTimer({remaining_seconds:300,is_running:false,is_break:true,started_at:null})}catch(error){console.error("Unable to start a shared break:",error);showNotice(error.message||"Could not start a shared break.")}};
let activeWhiteboardGroupId="", whiteboardRefreshTimer=null, whiteboardStrokes=[], isWhiteboardDrawing=false, isWhiteboardSaving=false, currentWhiteboardStroke=null, activeWhiteboardTool="pen";
function resizeWhiteboardCanvas(){const canvas=$("#groupWhiteboardCanvas"),rect=canvas.getBoundingClientRect(),ratio=window.devicePixelRatio||1;canvas.width=Math.round(rect.width*ratio);canvas.height=Math.round(rect.height*ratio);const context=canvas.getContext("2d");context.setTransform(ratio,0,0,ratio,0,0);drawWhiteboardStrokes()}
function drawWhiteboardStrokes(){const canvas=$("#groupWhiteboardCanvas"),context=canvas.getContext("2d"),rect=canvas.getBoundingClientRect();context.clearRect(0,0,rect.width,rect.height);whiteboardStrokes.forEach(stroke=>{const points=stroke.points;if(!Array.isArray(points)||!points.length)return;context.beginPath();context.strokeStyle=/^#[0-9a-f]{6}$/i.test(stroke.color)?stroke.color:"#5144d3";context.lineWidth=Math.min(10,Math.max(1,Number(stroke.width)||3));context.lineCap="round";context.lineJoin="round";points.forEach((point,index)=>{const x=Math.min(1,Math.max(0,Number(point.x)||0))*rect.width,y=Math.min(1,Math.max(0,Number(point.y)||0))*rect.height;if(index===0)context.moveTo(x,y);else context.lineTo(x,y)});if(points.length===1){const point=points[0];context.moveTo(point.x*rect.width,point.y*rect.height);context.lineTo(point.x*rect.width+.1,point.y*rect.height+.1)}context.stroke()})}
async function loadWhiteboardStrokes(){if(!activeWhiteboardGroupId||isWhiteboardDrawing||isWhiteboardSaving)return;const client=getSupabaseClient();if(!client)throw new Error("Supabase is unavailable.");const {data:strokes,error}=await client.from("study_group_whiteboard_strokes").select("id,created_by,points,color,width,created_at").eq("group_id",activeWhiteboardGroupId).order("created_at",{ascending:true}).limit(500);if(error)throw error;whiteboardStrokes=strokes||[];drawWhiteboardStrokes();$("#whiteboardSyncStatus").textContent=`Synced · ${whiteboardStrokes.length} shared strokes`}
async function openGroupWhiteboard(groupId){const group=data.groups.find(item=>item.id===groupId);if(!group){showNotice("Join this group before opening its whiteboard.");return}try{const client=getSupabaseClient(),userId=await getCurrentUserId();if(!client||!userId)throw new Error("Sign in to use the group whiteboard.");activeWhiteboardGroupId=groupId;whiteboardStrokes=[];$("#groupWhiteboardTitle").textContent=group.name+" whiteboard";$("#whiteboardSyncStatus").textContent="Connecting to shared canvas…";$("#clearWhiteboardBtn").classList.toggle("hidden",group.role!=="owner");openDialog("groupWhiteboardDialog");resizeWhiteboardCanvas();await loadWhiteboardStrokes();whiteboardRefreshTimer=setInterval(()=>loadWhiteboardStrokes().catch(error=>{console.error("Unable to refresh group whiteboard:",error);$("#whiteboardSyncStatus").textContent="Sync paused · "+error.message}),5000)}catch(error){stopWhiteboardRefresh();if($("#groupWhiteboardDialog").open)closeDialog("groupWhiteboardDialog");console.error("Unable to open group whiteboard:",error);showNotice(error.message||"Could not open group whiteboard.")}}
function stopWhiteboardRefresh(){clearInterval(whiteboardRefreshTimer);whiteboardRefreshTimer=null;activeWhiteboardGroupId="";isWhiteboardDrawing=false;isWhiteboardSaving=false;currentWhiteboardStroke=null}
$("#groupsGrid").addEventListener("click",event=>{const button=event.target.closest("[data-whiteboard]");if(button)openGroupWhiteboard(button.dataset.whiteboard)});
$("#closeWhiteboardBtn").onclick=()=>{stopWhiteboardRefresh();closeDialog("groupWhiteboardDialog")};
$("#groupWhiteboardDialog").addEventListener("close",stopWhiteboardRefresh);
$("#groupWhiteboardDialog").addEventListener("cancel",stopWhiteboardRefresh);
$$("[data-whiteboard-tool]").forEach(button=>button.addEventListener("click",()=>{
  activeWhiteboardTool=button.dataset.whiteboardTool;
  $$("[data-whiteboard-tool]").forEach(tool=>{const selected=tool===button;tool.classList.toggle("is-active",selected);tool.setAttribute("aria-pressed",String(selected))});
}));
window.addEventListener("resize",()=>{if(activeWhiteboardGroupId)resizeWhiteboardCanvas()});
$("#groupWhiteboardCanvas").addEventListener("pointerdown",event=>{if(!activeWhiteboardGroupId)return;const canvas=event.currentTarget,rect=canvas.getBoundingClientRect();isWhiteboardDrawing=true;canvas.setPointerCapture(event.pointerId);const width=Number($("#whiteboardWidth").value)||4;currentWhiteboardStroke={points:[{x:Math.min(1,Math.max(0,(event.clientX-rect.left)/rect.width)),y:Math.min(1,Math.max(0,(event.clientY-rect.top)/rect.height))}],color:activeWhiteboardTool==="eraser"?"#ffffff":$("#whiteboardColor").value,width:activeWhiteboardTool==="marker"?Math.min(10,width*2):width};const context=canvas.getContext("2d");context.beginPath();context.fillStyle=currentWhiteboardStroke.color;context.arc(event.clientX-rect.left,event.clientY-rect.top,currentWhiteboardStroke.width/2,0,Math.PI*2);context.fill()});
$("#groupWhiteboardCanvas").addEventListener("pointermove",event=>{if(!isWhiteboardDrawing||!currentWhiteboardStroke)return;const canvas=event.currentTarget,rect=canvas.getBoundingClientRect(),point={x:Math.min(1,Math.max(0,(event.clientX-rect.left)/rect.width)),y:Math.min(1,Math.max(0,(event.clientY-rect.top)/rect.height))};if(currentWhiteboardStroke.points.length>=2000)return;const previous=currentWhiteboardStroke.points[currentWhiteboardStroke.points.length-1];currentWhiteboardStroke.points.push(point);const context=canvas.getContext("2d");context.beginPath();context.strokeStyle=currentWhiteboardStroke.color;context.lineWidth=currentWhiteboardStroke.width;context.lineCap="round";context.lineJoin="round";context.moveTo(previous.x*rect.width,previous.y*rect.height);context.lineTo(point.x*rect.width,point.y*rect.height);context.stroke()});
$("#groupWhiteboardCanvas").addEventListener("pointerup",async()=>{if(!isWhiteboardDrawing||!currentWhiteboardStroke)return;isWhiteboardDrawing=false;isWhiteboardSaving=true;try{const client=getSupabaseClient(),userId=await getCurrentUserId();if(!client||!userId)throw new Error("Sign in to save whiteboard strokes.");const {error}=await client.from("study_group_whiteboard_strokes").insert({group_id:activeWhiteboardGroupId,created_by:userId,points:currentWhiteboardStroke.points,color:currentWhiteboardStroke.color,width:currentWhiteboardStroke.width});if(error)throw error;currentWhiteboardStroke=null;isWhiteboardSaving=false;try{await loadWhiteboardStrokes()}catch(refreshError){console.error("Whiteboard stroke was saved, but the canvas did not refresh:",refreshError);showNotice("Stroke saved, but the shared canvas could not refresh: "+refreshError.message)}}catch(error){console.error("Unable to save whiteboard stroke:",error);showNotice(error.message||"Could not save your whiteboard drawing.")}finally{isWhiteboardSaving=false}});
$("#groupWhiteboardCanvas").addEventListener("pointercancel",()=>{isWhiteboardDrawing=false;currentWhiteboardStroke=null;drawWhiteboardStrokes()});
$("#clearWhiteboardBtn").onclick=async()=>{if(!activeWhiteboardGroupId||!confirm("Clear the whiteboard for everyone in this group?"))return;const button=$("#clearWhiteboardBtn");button.disabled=true;try{const client=getSupabaseClient();if(!client)throw new Error("Supabase is unavailable.");const {error}=await client.from("study_group_whiteboard_strokes").delete().eq("group_id",activeWhiteboardGroupId);if(error)throw error;whiteboardStrokes=[];drawWhiteboardStrokes();$("#whiteboardSyncStatus").textContent="Board cleared";showNotice("Group whiteboard cleared.")}catch(error){console.error("Unable to clear group whiteboard:",error);showNotice(error.message||"Could not clear the whiteboard.")}finally{button.disabled=false}};
$("#undoWhiteboardBtn").onclick=async()=>{
  if(!activeWhiteboardGroupId)return;
  const button=$("#undoWhiteboardBtn");button.disabled=true;
  try{
    const client=getSupabaseClient(),userId=await getCurrentUserId();
    if(!client||!userId)throw new Error("Sign in to undo a whiteboard stroke.");
    const {data:stroke,error:selectError}=await client.from("study_group_whiteboard_strokes").select("id").eq("group_id",activeWhiteboardGroupId).eq("created_by",userId).order("created_at",{ascending:false}).limit(1).maybeSingle();
    if(selectError)throw selectError;
    if(!stroke){showNotice("You have no whiteboard strokes to undo.");return}
    const {error}=await client.from("study_group_whiteboard_strokes").delete().eq("id",stroke.id);
    if(error)throw error;
    await loadWhiteboardStrokes();
  }catch(error){console.error("Unable to undo whiteboard stroke:",error);showNotice(error.message||"Could not undo this stroke.")}
  finally{button.disabled=false}
};
function stopGroupChatRefresh(){clearInterval(groupChatRefreshTimer);groupChatRefreshTimer=null;activeGroupChatId=""}
$("#closeGroupChatBtn").onclick=()=>{stopGroupChatRefresh();closeDialog("groupChatDialog")};
$("#groupChatDialog").addEventListener("close",stopGroupChatRefresh);
$("#groupChatDialog").addEventListener("cancel",stopGroupChatRefresh);
$("#groupChatForm").addEventListener("submit",async event=>{event.preventDefault();const input=$("#groupChatInput"),message=input.value.trim(),group=data.groups.find(item=>item.id===activeGroupChatId);if(!message||!group)return;if(message.length>2000){showNotice("Keep group chat messages under 2,000 characters.");return}const button=$("#groupChatForm button[type='submit']");button.disabled=true;try{const client=getSupabaseClient(),userId=await getCurrentUserId();if(!client||!userId)throw new Error("Sign in to send a group message.");const isAnnouncement=group.role==="owner"&&$("#groupChatAnnouncement").checked;const {error}=await client.from("study_group_messages").insert({group_id:group.id,created_by:userId,message,is_announcement:isAnnouncement});if(error)throw error;input.value="";await loadGroupMessages()}catch(error){console.error("Unable to send group message:",error);showNotice(error.message||"Could not send this message.")}finally{button.disabled=false}});
function wireDynamic(){$$("[data-task]").forEach(el=>el.addEventListener("change",async()=>{const task=data.tasks.find(item=>item.id===el.dataset.task);if(!task)return;const previous=task.done,previousCompletedAt=task.completedAt,completedAt=el.checked?new Date().toISOString():null;try{if(task.shared){const client=getSupabaseClient();if(!client)throw new Error("Sign in to update this shared task.");const {error}=await client.from("study_group_tasks").update({done:el.checked,completed_at:completedAt}).eq("id",task.id).select("id").single();if(error)throw error}task.done=el.checked;task.completedAt=completedAt;save()}catch(error){el.checked=previous;task.done=previous;task.completedAt=previousCompletedAt;console.error("Unable to update shared study task:",error);showNotice(error.message||"Could not update task.")}}));$$("[data-addtask]").forEach(el=>el.addEventListener("click",()=>{fillGroupSelects();$("#taskGroup").value=el.dataset.addtask;openDialog("taskDialog")}));$$("[data-addnote]").forEach(el=>el.addEventListener("click",()=>{fillGroupSelects();$("#noteGroup").value=el.dataset.addnote;openDialog("noteDialog")}));$$("[data-copy]").forEach(el=>el.addEventListener("click",async()=>{try{await navigator.clipboard.writeText(el.dataset.copy);showNotice("Invite code copied: "+el.dataset.copy)}catch{showNotice("Invite code: "+el.dataset.copy)}}));$$("[data-room]").forEach(el=>el.addEventListener("click",()=>openGroupCall(el.dataset.room)));$$("[data-call]").forEach(el=>el.addEventListener("click",()=>{const session=data.sessions.find(item=>item.id===el.dataset.call);if(session?.groupId)openGroupCall(session.groupId);else showNotice("Choose a study group to open a private group call.")}));$$("[data-delete-session]").forEach(el=>el.addEventListener("click",()=>{data.sessions=data.sessions.filter(s=>s.id!==el.dataset.deleteSession);save()}));$$("[data-delete-note]").forEach(el=>el.addEventListener("click",async()=>{try{await removeNote(el.dataset.deleteNote)}catch(error){console.error("Unable to delete note:",error);showNotice(error.message||"Could not delete this resource.")}}))}
$("#notesGrid").addEventListener("click",e=>{const button=e.target.closest("[data-view-note]");if(button)viewNote(button.dataset.viewNote)});
$("#notesGrid").addEventListener("click",async e=>{const button=e.target.closest("[data-download-note]");if(!button)return;try{await downloadNote(button.dataset.downloadNote);showNotice("Download started.")}catch(error){console.error("Unable to download note:",error);showNotice(error.message||"Could not download this resource.")}});
$("#closeNoteViewerBtn").onclick=()=>closeDialog("noteViewerDialog");
$("#noteViewerDialog").addEventListener("close",()=>{activeNoteViewerId=""});
$("#noteCommentForm").addEventListener("submit",async event=>{
  event.preventDefault();
  const note=data.notes.find(item=>item.id===activeNoteViewerId),input=$("#noteCommentInput"),comment=input.value.trim(),button=$("#noteCommentForm button[type='submit']");
  if(!note||!comment)return;
  button.disabled=true;
  try{
    const userId=await getCurrentUserId();
    if(note.shared){
      const client=getSupabaseClient();
      if(!client||!userId)throw new Error("Sign in to comment on shared resources.");
      const {error}=await client.from("study_group_note_comments").insert({note_id:note.id,group_id:note.groupId,created_by:userId,comment});
      if(error)throw error;
      await loadNoteComments(note);
    }else{
      note.comments=Array.isArray(note.comments)?note.comments:[];
      note.comments.push({id:uid(),created_by:userId||"",comment,created_at:new Date().toISOString()});
      renderNoteComments(note.comments);
      localStorage.setItem(STORAGE_KEY,JSON.stringify(data));
    }
    input.value="";
  }catch(error){console.error("Unable to post resource comment:",error);showNotice(error.message||"Could not post your comment.")}
  finally{button.disabled=false}
});
$("#createGroupBtn").onclick=()=>openDialog("groupDialog");
$("#closeGroupDialogBtn").onclick=$("#cancelGroupBtn").onclick=()=>closeDialog("groupDialog");
$("#groupForm").addEventListener("submit",async e=>{e.preventDefault();const form=$("#groupForm"),button=$("#saveGroup"),name=$("#groupName").value.trim(),subject=$("#groupSubject").value.trim(),description=$("#groupDescription").value.trim(),client=getSupabaseClient();if(!name||!subject)return;if(!client||!await getCurrentUserId()){showNotice("Sign in before creating a group.");return}button.disabled=true;try{const groupCode=window.crypto?.randomUUID?crypto.randomUUID().replace(/-/g,"").slice(0,8).toUpperCase():uid();const {data:created,error}=await client.rpc("create_study_group",{p_id:uuid(),p_name:name,p_subject:subject,p_description:description,p_invite_code:groupCode});if(error)throw error;const group=Array.isArray(created)?created[0]:created;if(!group?.id)throw new Error("The group service returned no group.");data.groups.push({id:group.id,name:group.name,subject:group.subject,description:group.description,code:group.code,role:group.role});form.reset();closeDialog("groupDialog");await loadSharedGroupContent();save();showNotice("Study group created. Share its invite code with your team.")}catch(error){console.error("Unable to create study group:",error);showNotice(`Could not create group: ${error.message||"Please try again."}`)}finally{button.disabled=false}});
$("#joinGroupBtn").onclick=()=>{ $("#joinGroupForm").reset();$("#joinGroupStatus").textContent="";openDialog("joinGroupDialog") };
$("#closeJoinGroupDialogBtn").onclick=$("#cancelJoinGroupBtn").onclick=()=>closeDialog("joinGroupDialog");
$("#joinGroupCode").addEventListener("input",event=>{event.target.value=event.target.value.toUpperCase().replace(/\s/g,"")});
$("#joinGroupForm").addEventListener("submit",async event=>{event.preventDefault();const button=$("#submitJoinGroupBtn"),status=$("#joinGroupStatus"),code=$("#joinGroupCode").value.trim().toUpperCase(),client=getSupabaseClient();if(!client||!await getCurrentUserId()){status.textContent="Sign in before joining a group.";return}button.disabled=true;status.textContent="";try{const {data:joined,error}=await client.rpc("join_study_group",{p_invite_code:code});if(error)throw error;const group=Array.isArray(joined)?joined[0]:joined;if(!group?.id)throw new Error("The group service returned no group.");const existingIndex=data.groups.findIndex(item=>item.id===group.id);const normalized={id:group.id,name:group.name,subject:group.subject,description:group.description,code:group.code,role:group.role};if(existingIndex<0)data.groups.push(normalized);else data.groups[existingIndex]=normalized;await loadSharedGroupContent();closeDialog("joinGroupDialog");save();showNotice(`Joined ${group.name}. Shared notes and tasks are now available.`)}catch(error){console.error("Unable to join study group:",error);status.textContent=error.message||"Could not join this group. Check the invite code and try again."}finally{button.disabled=false}});
function openTask(){fillGroupSelects();openDialog("taskDialog")}$("#closeTaskDialogBtn").onclick=$("#cancelTaskBtn").onclick=()=>closeDialog("taskDialog");$("#taskForm").addEventListener("submit",async event=>{event.preventDefault();const form=$("#taskForm"),button=$("#saveTask"),title=$("#taskTitle").value.trim(),groupId=$("#taskGroup").value,due=$("#taskDue").value;if(!title)return;button.disabled=true;try{let task;if(groupId){const client=getSupabaseClient(),userId=await getCurrentUserId();if(!client||!userId)throw new Error("Sign in to add a shared group task.");const {data:created,error}=await client.from("study_group_tasks").insert({group_id:groupId,created_by:userId,title,due:due||null}).select("id,group_id,title,due,done,completed_at,created_by").single();if(error)throw error;task={id:created.id,title:created.title,groupId:created.group_id,due:created.due||"",done:created.done,completedAt:created.completed_at,shared:true,createdBy:created.created_by}}else task={id:uid(),title,groupId:"",due,done:false,completedAt:null};data.tasks.push(task);form.reset();closeDialog("taskDialog");save();showNotice(groupId?"Task shared with group members.":"Personal task added.")}catch(error){console.error("Unable to add study task:",error);showNotice(`Could not add task: ${error.message||"Please try again."}`)}finally{button.disabled=false}});
$("#addSessionQuick").onclick=$("#createSessionBtn").onclick=()=>{fillGroupSelects();$("#sessionDate").value=dateKey(new Date(Date.now()+3600000));$("#sessionTime").value="18:00";openDialog("sessionDialog")};
$("#closeSessionDialogBtn").onclick=$("#cancelSessionBtn").onclick=()=>closeDialog("sessionDialog");$("#sessionForm").addEventListener("submit",e=>{e.preventDefault();const s={id:uid(),title:$("#sessionTitle").value.trim(),groupId:$("#sessionGroup").value,date:$("#sessionDate").value,time:$("#sessionTime").value,reminder:Number($("#sessionReminder").value),reminded:false};if(!s.title||!s.date||!s.time)return;data.sessions.push(s);$("#sessionForm").reset();closeDialog("sessionDialog");save();showNotice("Session scheduled. Keep this app open for in-app reminders; browser notifications need permission.")});
$("#addNoteBtn").onclick=()=>{fillGroupSelects();$("#noteGroup").value=$("#resourceGroupFilter").value!=="all"&&$("#resourceGroupFilter").value!=="personal"?$("#resourceGroupFilter").value:"";renderResourceFolderOptions();openDialog("noteDialog")};
$("#closeNoteDialogBtn").onclick=$("#cancelNoteBtn").onclick=()=>closeDialog("noteDialog");
$("#noteGroup").addEventListener("change",renderResourceFolderOptions);
$("#noteForm").addEventListener("submit",async event=>{
  event.preventDefault();
  const form=$("#noteForm"),button=$("#saveNote"),title=$("#noteTitle").value.trim(),content=$("#noteContent").value.trim(),groupId=$("#noteGroup").value||"";
  if(!title)return;
  button.disabled=true;
  try{
    const selectedFolder=folderFor(groupId,$("#noteFolder").value);
    let note;
    if(groupId){
      const client=getSupabaseClient(),userId=await getCurrentUserId();
      if(!client||!userId)throw new Error("Sign in to share a note with this group.");
      const {data:created,error}=await client.from("study_group_notes").insert({group_id:groupId,folder_id:selectedFolder.id||null,created_by:userId,title,content,mime_type:"text/plain"}).select("id,group_id,folder_id,title,content,created_by,created_at").single();
      if(error)throw error;
      note={id:created.id,title:created.title,content:created.content,date:new Date(created.created_at).toLocaleDateString(),type:"text/plain",groupId:created.group_id,folderId:created.folder_id||"",folderName:selectedFolder.name,shared:true,createdBy:created.created_by,comments:[]};
    }else note={id:uid(),title,content,date:new Date().toLocaleDateString(),type:"text/plain",groupId:"",folderId:selectedFolder.id,folderName:selectedFolder.name,comments:[]};
    data.notes.push(note);form.reset();closeDialog("noteDialog");save();showNotice(groupId?"Note shared with group members.":"Note saved in your personal library.");
  }catch(error){console.error("Unable to save study note:",error);showNotice(`Could not save note: ${error.message||"Please try again."}`)}
  finally{button.disabled=false}
});
function readFileDataUrl(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error||new Error("Could not read selected file."));reader.readAsDataURL(file)})}
$("#createResourceFolderBtn").onclick=()=>{fillGroupSelects();$("#resourceFolderGroup").value=$("#resourceGroupFilter").value!=="all"&&$("#resourceGroupFilter").value!=="personal"?$("#resourceGroupFilter").value:"";$("#resourceFolderForm").reset();$("#resourceFolderGroup").value=$("#resourceGroupFilter").value!=="all"&&$("#resourceGroupFilter").value!=="personal"?$("#resourceGroupFilter").value:"";openDialog("resourceFolderDialog")};
$("#closeResourceFolderBtn").onclick=$("#cancelResourceFolderBtn").onclick=()=>closeDialog("resourceFolderDialog");
$("#resourceFolderForm").addEventListener("submit",async event=>{
  event.preventDefault();
  const button=$("#resourceFolderForm button[type='submit']");
  button.disabled=true;
  try{
    const folder=await createResourceFolder($("#resourceFolderGroup").value||"",$("#resourceFolderName").value);
    closeDialog("resourceFolderDialog");$("#resourceFolderForm").reset();renderNotes();showNotice(`Folder "${folder.name}" created.`);
  }catch(error){console.error("Unable to create resource folder:",error);showNotice(error.message||"Could not create this folder.")}
  finally{button.disabled=false}
});
$("#resourceGroupFilter").addEventListener("change",()=>{renderResourceFolderOptions();renderNotes()});
$("#resourceFolderFilter").addEventListener("change",renderNotes);
$("#resourceSearch").addEventListener("input",renderNotes);
$("#fileGroupSelect").addEventListener("change",renderResourceFolderOptions);
$("#fileInput").addEventListener("change",async event=>{
  let uploaded=0,localOnly=0;
  const failures=[],localFallbacks=[];
  const selectedGroup=$("#fileGroupSelect").value||"",selectedFolder=$("#fileFolderSelect").value||"";
  for(const file of [...event.target.files]){
    if(file.size>4*1024*1024){failures.push(`${file.name} exceeds the 4 MB upload limit`);continue}
    if(!(file.type.startsWith("image/")||file.type==="application/pdf"||file.type==="text/plain")){
      failures.push(`${file.name} is not a supported file type`);continue;
    }
    if(!selectedGroup&&file.size>1024*1024){failures.push(`${file.name} exceeds the 1 MB personal-storage limit`);continue}
    const title=file.name.replace(/\.[^.]+$/,"");
    let userId=null,selectedFolderInfo,content="";
    let cloudInfo=null,sharedNote=null;
    try{
      userId=await getCurrentUserId();
      selectedFolderInfo=folderFor(selectedGroup,selectedFolder);
      content=file.type==="text/plain"?(await file.text()).slice(0,5000):"";
      const client=getSupabaseClient();
      if(selectedGroup&&(!client||!userId))throw new Error("Sign in before sharing a file with a study group.");
      if(client&&userId){
        if(selectedGroup&&!await ensureGroupMembership(selectedGroup))throw new Error("Your account is not a member of the selected group.");
        cloudInfo=await uploadToSupabaseStorage(file,{bucket:selectedGroup?"group-private":"user-private",folder:selectedGroup?`groups/${selectedGroup}`:`users/${userId}`});
        if(selectedGroup){
          const {data:created,error}=await client.from("study_group_notes").insert({group_id:selectedGroup,folder_id:selectedFolderInfo.id||null,created_by:userId,title,file_name:file.name,mime_type:file.type||"application/octet-stream",storage_bucket:cloudInfo.bucket,storage_path:cloudInfo.path,content}).select("id,group_id,folder_id,title,content,file_name,mime_type,storage_bucket,storage_path,created_by,created_at").single();
          if(error)throw error;
          sharedNote={id:created.id,title:created.title,content:created.content||"",fileName:created.file_name,type:created.mime_type,date:new Date(created.created_at).toLocaleDateString(),groupId:created.group_id,folderId:created.folder_id||"",folderName:selectedFolderInfo.name,shared:true,createdBy:created.created_by,cloudBucket:created.storage_bucket,cloudPath:created.storage_path,comments:[]};
        }
      }
    }catch(error){
      console.error("Unable to upload study resource:",error);
      if(cloudInfo?.path){
        const client=getSupabaseClient();
        if(client){const {error:cleanupError}=await client.storage.from(cloudInfo.bucket).remove([cloudInfo.path]);if(cleanupError)console.error("Could not clean up an unlinked uploaded file:",cleanupError)}
      }
      if(!selectedFolderInfo){failures.push(`${file.name}: ${error.message||"Folder selection is invalid"}`);continue}
      if(selectedGroup){failures.push(`${file.name} was not shared: ${error.message||"Upload failed"}`);continue}
      console.error("Personal cloud upload failed; trying browser storage:",error);
      localFallbacks.push(`${file.name} was saved only in this browser because cloud upload failed`);
      cloudInfo=null;
    }
    if(sharedNote){data.notes.push(sharedNote);uploaded++;continue}
    let dataUrl="";
    if(!cloudInfo?.path){
      try{dataUrl=await readFileDataUrl(file)}
      catch(error){console.error("Unable to read selected study file:",error);failures.push(`${file.name} could not be read`);continue}
    }
    const note={id:uid(),title,fileName:file.name,type:file.type,dataUrl,content,date:new Date().toLocaleDateString(),groupId:"",folderId:selectedFolderInfo.id,folderName:selectedFolderInfo.name,cloudBucket:cloudInfo?.bucket||null,cloudPath:cloudInfo?.path||null,comments:[]};
    data.notes.push(note);
    if(cloudInfo?.path)uploaded++;else localOnly++;
  }
  event.target.value="";
  save();
  const results=[];
  if(uploaded)results.push(`${uploaded} file${uploaded===1?"":"s"} added to the library`);
  if(localOnly)results.push(`${localOnly} file${localOnly===1?"":"s"} saved in your personal library`);
  if(localFallbacks.length)results.push(localFallbacks.join("; "));
  if(failures.length)results.push(`${failures.length} upload${failures.length===1?"":"s"} failed: ${failures.join("; ")}`);
  showNotice(results.join(". ")||"Choose one or more files to upload.");
});
function setTimerDisplay(){const m=Math.floor(seconds/60),s=seconds%60;$("#timerDisplay").textContent=`${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;const elapsed=initialSeconds-seconds;$("#timerRing").style.background=`conic-gradient(#7165eb ${Math.min(360,elapsed/initialSeconds*360)}deg,#e8e7fb 0deg)`;$("#timerStatus").textContent=timerRunning?"Stay focused":seconds===initialSeconds?"Ready when you are":"Paused"}
function stopTimer(){clearInterval(timerInterval);timerInterval=null;timerRunning=false;$("#timerStart").textContent="▶ Start";setTimerDisplay()}
function startTimer(){if(timerRunning){stopTimer();return}timerRunning=true;$("#timerStart").textContent="Ⅱ Pause";$("#timerStatus").textContent="Stay focused";timerInterval=setInterval(()=>{seconds--;setTimerDisplay();if(seconds<=0){clearInterval(timerInterval);timerInterval=null;timerRunning=false;if(!timerIsBreak){const mins=Math.round(initialSeconds/60);data.studyLog[dateKey(new Date())]=(data.studyLog[dateKey(new Date())]||0)+mins;recordCompletedStudySession(mins).catch(error=>{console.error("Unable to sync completed study session:",error);showNotice("Session saved here, but history could not sync: "+error.message)});save();showNotice(`Focus session complete: ${mins} minutes recorded. Take a short break!`);if("Notification"in window&&Notification.permission==="granted")new Notification("FocusTogether",{body:"Focus session complete. Take a short break."})}else showNotice("Break complete. Ready for another focus session?");timerIsBreak=!timerIsBreak;seconds=(timerIsBreak?5:25)*60;initialSeconds=seconds;$("#timerMode").textContent=timerIsBreak?"BREAK TIME":"FOCUS SESSION";$("#timerStart").textContent="▶ Start";setTimerDisplay()}},1000)}
$("#timerStart").onclick=startTimer;$("#timerReset").onclick=()=>{stopTimer();seconds=initialSeconds;setTimerDisplay()};$("#timerBreak").onclick=()=>{stopTimer();timerIsBreak=true;seconds=initialSeconds=5*60;$("#timerMode").textContent="BREAK TIME";setTimerDisplay()};$("#quickStart").onclick=$("#heroStart").onclick=()=>{showView("dashboard");if(!timerRunning)startTimer();else showNotice("Your focus timer is already running.")};
$("#focusToggle").onclick=()=>{document.body.classList.toggle("focus-mode");$("#focusToggle").textContent=document.body.classList.contains("focus-mode")?"Disable focus mode":"Enable focus mode"};
function updateProfileUI(){const name=data.name?.trim()||"Student";const avatar=$("#profileAvatar");$("#profileName").textContent=name;$("#profileBio").textContent=data.bio?.trim()||"Study workspace";avatar.innerHTML=data.avatarDataUrl?`<img src="${data.avatarDataUrl}" alt="${escapeHtml(name)}'s profile photo"/>`:escapeHtml(name[0].toUpperCase())}
let draftProfilePhoto="";
function renderProfileEditor(){draftProfilePhoto=data.avatarDataUrl||"";$("#profileEditName").value=data.name||"Student";$("#profileEditBio").value=data.bio||"";$("#profileFriendUid").textContent=myFriendUid||"Loading…";renderProfilePhotoPreview()}
function renderProfilePhotoPreview(){const preview=$("#profileEditorAvatar");preview.innerHTML=draftProfilePhoto?`<img src="${draftProfilePhoto}" alt="Profile photo preview"/>`:escapeHtml($("#profileEditName").value.trim()[0]?.toUpperCase()||"S")}
function resizeProfilePhoto(file){return readFileDataUrl(file).then(dataUrl=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{const size=256,canvas=document.createElement("canvas");canvas.width=size;canvas.height=size;const context=canvas.getContext("2d");if(!context){reject(new Error("Could not process the selected photo."));return}const cropSize=Math.min(image.width,image.height);const x=(image.width-cropSize)/2,y=(image.height-cropSize)/2;context.drawImage(image,x,y,cropSize,cropSize,0,0,size,size);resolve(canvas.toDataURL("image/jpeg",0.82))};image.onerror=()=>reject(new Error("Could not open the selected image."));image.src=dataUrl}))}
$("#editName").onclick=()=>{renderProfileEditor();openDialog("profileDialog")};
$("#closeProfileDialogBtn").onclick=$("#cancelProfileBtn").onclick=()=>closeDialog("profileDialog");
$("#profileEditName").addEventListener("input",renderProfilePhotoPreview);
$("#removeProfilePhotoBtn").onclick=()=>{draftProfilePhoto="";$("#profilePhoto").value="";renderProfilePhotoPreview()};
$("#profilePhoto").addEventListener("change",async event=>{const file=event.target.files?.[0];if(!file)return;if(!file.type.startsWith("image/")){showNotice("Please choose an image file.");event.target.value="";return}try{draftProfilePhoto=await resizeProfilePhoto(file);renderProfilePhotoPreview()}catch(error){console.error("Profile photo processing failed:",error);showNotice(error.message||"Could not use this photo.")}});
$("#profileForm").addEventListener("submit",async event=>{event.preventDefault();const name=$("#profileEditName").value.trim();if(!name){showNotice("Please enter a display name.");return}if(draftProfilePhoto.length>400000){showNotice("Profile photo is too large to share. Choose a smaller image.");return}data.name=name;data.bio=$("#profileEditBio").value.trim();data.avatarDataUrl=draftProfilePhoto;save();closeDialog("profileDialog");$("#profilePhoto").value="";try{const userId=await getCurrentUserId();if(userId){const client=getSupabaseClient();await syncMyStudyProfile(userId);await loadStudyFriends(client);syncFriendPresence(client,userId);await Promise.all([...friendPresenceChannels.values()].map(channel=>channel.track({display_name:data.name||"Student"})));renderFriends()}showNotice("Profile updated.")}catch(error){console.error("Unable to share the updated profile with study friends:",error);showNotice("Profile saved here, but the shared profile could not be updated: "+error.message)}});
$("#notifyBtn").onclick=async()=>{if(!("Notification"in window)){showNotice("This browser does not support browser notifications.");return}const p=await Notification.requestPermission();showNotice(p==="granted"?"Browser notifications enabled.":"Notifications were not enabled.")};
function checkReminders(){const now=new Date();data.sessions.forEach(s=>{const when=new Date(`${s.date}T${s.time}`);const alertAt=new Date(when.getTime()-s.reminder*60000);if(!s.reminded&&now>=alertAt&&now<=new Date(when.getTime()+60000)){s.reminded=true;showNotice(`Study time: ${s.title} (${s.time}). Open your study room when ready.`);if("Notification"in window&&Notification.permission==="granted")new Notification("Study time is here",{body:`${s.title} · ${s.time}`})}});localStorage.setItem(STORAGE_KEY,JSON.stringify(data))}
setInterval(checkReminders,15000);
setInterval(refreshStudyGoalsForNewPeriod,60000);
document.addEventListener("visibilitychange",()=>{if(!document.hidden)refreshStudyGoalsForNewPeriod()});
async function saveStudyGoals(){resetExpiredStudyGoals();save();try{const client=getSupabaseClient(),userId=await getCurrentUserId();if(client&&userId){const {error}=await client.from("study_daily_goals").upsert(studyGoalsCloudRow(userId),{onConflict:"user_id"});if(error)throw error;dailyGoalLoadedUserId=userId;showNotice("Your goals were saved and synced.")}else showNotice("Your goals were saved in this browser. Sign in to sync them.")}catch(error){console.error("Unable to sync study goals:",error);showNotice("Goals saved here, but cloud sync failed: "+error.message)}}
$("#dailyGoalForm").addEventListener("submit",async event=>{event.preventDefault();const goal=$("#dailyGoalInput").value.trim();if(!goal){showNotice("Write your goal for today first.");return}data.dailyGoalText=goal.slice(0,200);data.dailyGoalDate=dateKey(new Date());data.dailyGoalCompleted=false;await saveStudyGoals()});
$("#weeklyGoalForm").addEventListener("submit",async event=>{event.preventDefault();const goal=$("#weeklyGoalInput").value.trim();if(!goal){showNotice("Write your goal for this week first.");return}data.weeklyGoalText=goal.slice(0,200);data.weeklyGoalWeekStart=weekStartKey();data.weeklyGoalCompleted=false;await saveStudyGoals()});
$("#dailyGoalToggle").addEventListener("click",async()=>{if(!data.dailyGoalText)return;data.dailyGoalCompleted=!data.dailyGoalCompleted;await saveStudyGoals()});
$("#weeklyGoalToggle").addEventListener("click",async()=>{if(!data.weeklyGoalText)return;data.weeklyGoalCompleted=!data.weeklyGoalCompleted;await saveStudyGoals()});
$("#progressRangeForm").addEventListener("submit",event=>{event.preventDefault();const start=$("#progressStartDate").value,end=$("#progressEndDate").value;if(!start||!end){showNotice("Choose both the start and end dates.");return}if(start>end){showNotice("The start date must be on or before the end date.");return}const dayCount=Math.round((new Date(`${end}T00:00:00`)-new Date(`${start}T00:00:00`))/86400000)+1;if(dayCount>366){showNotice("Choose a date range of one year or less.");return}data.progressStartDate=start;data.progressEndDate=end;save()});
$$("[data-progress-days]").forEach(button=>button.addEventListener("click",()=>{
  const days=Number(button.dataset.progressDays),end=new Date();end.setHours(0,0,0,0);
  const start=new Date(end);start.setDate(start.getDate()-days+1);
  data.progressStartDate=dateKey(start);data.progressEndDate=dateKey(end);save();
}));
$("#downloadProgressReport").addEventListener("click",downloadProgressReport);
function addChat(text,who){data.chat.push({text,who});renderChat()}
function renderChat(){const box=$("#chatMessages");if(!box)return;const chats=data.chat.slice(-30);box.innerHTML=`<div class="chat-bubble bot">Hi! I'm your AI study helper. Ask me a question or choose a prompt below.</div>`+chats.map(c=>`<div class="chat-bubble ${c.who==="user"?"user":"bot"}">${escapeHtml(c.text)}</div>`).join("");box.scrollTop=box.scrollHeight}
function renderAssistantNotes(){const select=$("#assistantSavedNote");if(!select)return;const available=data.notes.filter(note=>typeof note.content==="string"&&note.content.trim());const selected=select.value;select.innerHTML='<option value="">Choose a text note (optional)</option>'+available.map(note=>`<option value="${escapeHtml(note.id)}">${escapeHtml(note.title)}</option>`).join("");if(available.some(note=>note.id===selected))select.value=selected}
$("#assistantSavedNote").addEventListener("change",()=>{const note=data.notes.find(item=>item.id===$("#assistantSavedNote").value);if(note)$("#assistantMaterial").value=note.content.slice(0,12000)});
$("#assistantTextFile").addEventListener("change",async event=>{const file=event.target.files?.[0];if(!file)return;if(file.size>2*1024*1024){showNotice("Text files must be 2 MB or smaller.");event.target.value="";return}try{$("#assistantMaterial").value=(await file.text()).slice(0,12000);if(file.size>12000)showNotice("Text loaded. The AI uses up to 12,000 characters.")}catch(error){console.error("Could not read study material:",error);showNotice("Could not read this text file: "+error.message)}finally{event.target.value=""}});
const assistantImageLabel=document.createElement("label"),assistantImageFile=document.createElement("input"),assistantImageAttachment=document.createElement("div"),assistantImagePreview=document.createElement("img"),assistantImageName=document.createElement("span"),assistantImageRemove=document.createElement("button");
assistantImageLabel.className="assistant-image-label";
assistantImageLabel.append(document.createTextNode("Ask about an image"));
assistantImageFile.id="assistantImageFile";assistantImageFile.type="file";assistantImageFile.accept="image/jpeg,image/png,image/webp,image/gif";
assistantImageLabel.append(assistantImageFile);
assistantImageAttachment.id="assistantImageAttachment";assistantImageAttachment.className="assistant-image-attachment hidden";
assistantImagePreview.id="assistantImagePreview";assistantImagePreview.alt="Selected image preview";
assistantImageName.id="assistantImageName";
assistantImageRemove.id="assistantImageRemove";assistantImageRemove.className="secondary-button";assistantImageRemove.type="button";assistantImageRemove.textContent="Remove image";
assistantImageAttachment.append(assistantImagePreview,assistantImageName,assistantImageRemove);
$("#assistantTextFile").parentElement.parentElement.append(assistantImageLabel,assistantImageAttachment);
const assistantPrivacyNote=$(".assistant-side .warning-note");
if(assistantPrivacyNote)assistantPrivacyNote.textContent="Your messages, selected study material, and attached images are sent to a secure Supabase Edge Function. The Gemini API key stays on the server and is never exposed in this app. Images must be JPEG, PNG, WebP, or GIF files up to 3 MB. PDF files are not parsed here yet; paste their text or use a text export.";
let assistantImage=null;
function clearAssistantImage(){assistantImage=null;$("#assistantImagePreview").removeAttribute("src");$("#assistantImageName").textContent="";$("#assistantImageAttachment").classList.add("hidden")}
$("#assistantImageFile").addEventListener("change",async event=>{const file=event.target.files?.[0];if(!file)return;const supportedTypes=["image/jpeg","image/png","image/webp","image/gif"];if(!supportedTypes.includes(file.type)){showNotice("Choose a JPEG, PNG, WebP, or GIF image.");event.target.value="";return}if(file.size>3*1024*1024){showNotice("Images must be 3 MB or smaller.");event.target.value="";return}try{const dataUrl=await readFileDataUrl(file);if(typeof dataUrl!=="string"||!dataUrl.includes(","))throw new Error("Could not read the selected image.");assistantImage={data:dataUrl.slice(dataUrl.indexOf(",")+1),mimeType:file.type,name:file.name};$("#assistantImagePreview").src=dataUrl;$("#assistantImageName").textContent=file.name;$("#assistantImageAttachment").classList.remove("hidden")}catch(error){console.error("Could not read study image:",error);showNotice("Could not read this image: "+error.message)}finally{event.target.value=""}});
$("#assistantImageRemove").addEventListener("click",clearAssistantImage);
$("#assistantMode").addEventListener("change",()=>{const placeholders={ask:"Ask an academic question...",summary:"What should I focus on in this summary?",quiz:"Which topic should the quiz focus on?",flashcards:"Which topic should the flashcards cover?",plan:"What is your goal or deadline?"};$("#chatInput").placeholder=placeholders[$("#assistantMode").value]||placeholders.ask});
async function sendChatMessage(event){
  event.preventDefault();
  const input=$("#chatInput"),sendButton=$("#chatForm button[type='submit']"),userQuestion=input.value.trim(),material=$("#assistantMaterial").value.trim(),mode=$("#assistantMode").value,language=$("#assistantLanguage").value,image=assistantImage;
  if(!userQuestion)return;
  if(userQuestion.length>4000){showNotice("Please keep your question under 4,000 characters.");return}
  if(material.length>12000){showNotice("Study material must be under 12,000 characters.");return}
  const client=getSupabaseClient();
  if(!client){showNotice("Supabase is unavailable. Check your connection and configuration.");return}
  addChat(`${userQuestion}${image?`\n[Image attached: ${image.name}]`:""}`,"user");
  input.value="";
  input.disabled=true;
  sendButton.disabled=true;
  sendButton.textContent="Thinking…";
  const box=$("#chatMessages"),pending=document.createElement("div");
  pending.className="chat-bubble bot";
  pending.textContent="Thinking…";
  pending.setAttribute("aria-label","AI is preparing an answer");
  box.appendChild(pending);
  box.scrollTop=box.scrollHeight;
  const controller=new AbortController();
  let timedOut=false;
  const timeoutId=setTimeout(()=>{timedOut=true;controller.abort()},45000);
  try{
    const {data:response,error}=await client.functions.invoke("study-ai",{body:{question:userQuestion,material,mode,language,image:image?{data:image.data,mimeType:image.mimeType}:undefined},signal:controller.signal});
    if(error)throw error;
    if(typeof response?.answer!=="string"||!response.answer.trim())throw new Error("The AI service returned an empty answer.");
    addChat(response.answer.trim(),"bot");
    if(image&&assistantImage===image)clearAssistantImage();
  }catch(error){
    console.error("AI study assistant request failed:",error);
    let message=timedOut
      ?"The AI is taking too long to respond. Please try again."
      :error instanceof Error?error.message:"Please try again.";
    if(!timedOut&&error&&typeof error==="object"&&"context"in error&&error.context instanceof Response){
      if(error.context.status===429){
        message="Gemini is temporarily limiting requests for this project. Wait a minute and retry; if it continues, check this model's rate limits in AI Studio.";
      }else{
        try{
          const body=await error.context.clone().json();
          if(typeof body?.error==="string")message=body.error;
        }catch(parseError){
          console.warn("Could not read AI error response:",parseError);
        }
      }
    }
    showNotice(`Could not get an AI answer: ${message}`);
  }finally{
    clearTimeout(timeoutId);
    pending.remove();
    input.disabled=false;
    sendButton.disabled=false;
    sendButton.textContent="Send ↑";
    input.focus();
  }
}
$("#chatForm").addEventListener("submit",sendChatMessage);
$$(".suggestion").forEach(b=>b.addEventListener("click",()=>{$("#assistantMode").value=b.textContent.includes("revision")?"plan":b.textContent.includes("Quiz")?"quiz":"ask";$("#assistantMode").dispatchEvent(new Event("change"));$("#chatInput").value=b.textContent;$("#chatForm").requestSubmit()}));
let callChannel=null, callPeerId="", callRoom="", activeScreenStream=null, callAttemptId=0;
const callPeers=new Map();
function setCallStatus(message){$("#callStatus").textContent=message}
function setCallButtons(connected){$("#joinCallBtn").disabled=connected;$("#cameraBtn").disabled=!connected;$("#micBtn").disabled=!connected;$("#shareBtn").disabled=!connected}
function addRemoteCallTile(peerId,stream){let tile=$("#remote-"+peerId);if(!tile){tile=document.createElement("div");tile.className="call-video-tile";tile.id="remote-"+peerId;const video=document.createElement("video");video.autoplay=true;video.playsInline=true;const label=document.createElement("span");label.textContent=callPeers.get(peerId)?.name||"Participant";tile.append(video,label);$("#callVideoGrid").append(tile)}tile.querySelector("video").srcObject=stream}
function closeCallPeer(peerId){const peer=callPeers.get(peerId);if(peer){peer.connection.close();callPeers.delete(peerId)}$("#remote-"+peerId)?.remove()}
function createCallPeer(peerId,name="Participant"){let peer=callPeers.get(peerId);if(peer)return peer;const connection=new RTCPeerConnection({iceServers:[{urls:"stun:stun.l.google.com:19302"}]});peer={connection,pendingCandidates:[],name};callPeers.set(peerId,peer);for(const track of activeStream.getTracks())connection.addTrack(track,activeStream);connection.onicecandidate=event=>{if(event.candidate)sendCallSignal(peerId,{candidate:event.candidate.toJSON()}).catch(error=>{console.error("Unable to send call network candidate:",error);setCallStatus("Call connection error: "+error.message)})};connection.ontrack=event=>addRemoteCallTile(peerId,event.streams[0]);connection.onconnectionstatechange=()=>{if(connection.connectionState==="connected")setCallStatus(`In the call with ${callPeers.size} participant${callPeers.size===1?"":"s"}.`);else if(connection.connectionState==="failed")setCallStatus("Could not connect to a participant. This network may require a TURN server.")};return peer}
async function sendCallSignal(to,message){if(!callChannel)throw new Error("Call signaling is not connected.");const result=await callChannel.send({type:"broadcast",event:"signal",payload:{from:callPeerId,to,name:data.name||"Student",...message}});if(result!=="ok")throw new Error(`Call signaling failed (${result}).`)}
async function flushCallCandidates(peer){for(const candidate of peer.pendingCandidates.splice(0))await peer.connection.addIceCandidate(candidate)}
async function createCallOffer(peerId,name){const peer=createCallPeer(peerId,name);const offer=await peer.connection.createOffer();await peer.connection.setLocalDescription(offer);await sendCallSignal(peerId,{description:peer.connection.localDescription.toJSON()})}
async function handleCallSignal(payload){if(!payload||payload.to!==callPeerId||!payload.from)return;const peer=createCallPeer(payload.from,payload.name||"Participant");if(payload.description?.type==="offer"){await peer.connection.setRemoteDescription(payload.description);await flushCallCandidates(peer);const answer=await peer.connection.createAnswer();await peer.connection.setLocalDescription(answer);await sendCallSignal(payload.from,{description:peer.connection.localDescription.toJSON()})}else if(payload.description?.type==="answer"){await peer.connection.setRemoteDescription(payload.description);await flushCallCandidates(peer)}else if(payload.candidate){if(peer.connection.remoteDescription)await peer.connection.addIceCandidate(payload.candidate);else peer.pendingCandidates.push(payload.candidate)}}
function syncCallParticipants(){const participants=callChannel.presenceState();const activeIds=new Set();Object.values(participants).flat().forEach(member=>{if(!member.peerId||member.peerId===callPeerId)return;activeIds.add(member.peerId);if(callPeerId<member.peerId&&!callPeers.has(member.peerId))createCallOffer(member.peerId,member.name||"Participant").catch(error=>{console.error("Unable to start peer call:",error);setCallStatus("Could not start call: "+error.message)})});for(const peerId of callPeers.keys())if(!activeIds.has(peerId))closeCallPeer(peerId);const count=activeIds.size;setCallStatus(count?`Connecting to ${count} participant${count===1?"":"s"}…`:`Room ${callRoom} is ready. Waiting for others to join…`)}
async function joinCall(){if(activeStream)return;const roomCode=$("#callRoomCode").value.trim().toUpperCase();if(!/^[A-Z0-9-]{4,32}$/.test(roomCode)){setCallStatus("Enter a valid room code (4–32 letters, numbers, or hyphens).");return}const client=getSupabaseClient();if(!client){setCallStatus("Supabase is unavailable. Check your internet connection and configuration.");return}if(!navigator.mediaDevices?.getUserMedia||typeof RTCPeerConnection==="undefined"){setCallStatus("Camera and microphone calls require a supported browser on HTTPS or localhost.");return}const attempt=++callAttemptId;setCallButtons(true);$("#joinCallBtn").disabled=true;setCallStatus("Requesting camera and microphone permission…");try{const stream=await navigator.mediaDevices.getUserMedia({audio:true,video:true});if(attempt!==callAttemptId){stream.getTracks().forEach(track=>track.stop());return}activeStream=stream;callRoom=roomCode;callPeerId=uuid();$("#localVideo").srcObject=activeStream;$("#localVideoTile").classList.remove("hidden");$("#localVideoLabel").textContent=`${data.name||"You"} (you)`;$("#cameraBtn").textContent="Turn camera off";$("#micBtn").textContent="Mute microphone";callChannel=client.channel(`focus-call-${roomCode}`,{config:{broadcast:{self:false},presence:{key:callPeerId}}});callChannel.on("broadcast",{event:"signal"},({payload})=>{handleCallSignal(payload).catch(error=>{console.error("Call signaling message failed:",error);setCallStatus("Call setup error: "+error.message)})});callChannel.on("presence",{event:"sync"},syncCallParticipants);callChannel.subscribe(async status=>{if(attempt!==callAttemptId)return;if(status==="SUBSCRIBED"){try{await callChannel.track({peerId:callPeerId,name:data.name||"Student"});if(attempt===callAttemptId)syncCallParticipants()}catch(error){if(attempt!==callAttemptId)return;console.error("Unable to join call room:",error);leaveCall();setCallStatus("Could not join room: "+error.message)}}else if(status==="CHANNEL_ERROR"||status==="TIMED_OUT"||status==="CLOSED"){leaveCall();setCallStatus("Call signaling disconnected ("+status+"). Check Supabase Realtime and try again.")}});setCallStatus(`Joining room ${roomCode}…`)}catch(error){if(attempt!==callAttemptId)return;console.error("Unable to start camera/microphone call:",error);leaveCall();setCallStatus("Camera or microphone unavailable: "+error.message)}}
function replaceOutgoingVideoTrack(track){callPeers.forEach(peer=>{const sender=peer.connection.getSenders().find(item=>item.track?.kind==="video");if(sender)sender.replaceTrack(track).catch(error=>{console.error("Unable to switch shared video source:",error);setCallStatus("Unable to switch video source: "+error.message)})})}
async function stopScreenSharing(){if(!activeScreenStream)return;const screenStream=activeScreenStream;activeScreenStream=null;screenStream.getTracks().forEach(track=>track.stop());const cameraTrack=activeStream?.getVideoTracks()[0];if(cameraTrack)replaceOutgoingVideoTrack(cameraTrack);if(activeStream)$("#localVideo").srcObject=activeStream;$("#shareBtn").textContent="Share screen"}
function leaveCall(){callAttemptId++;if(activeScreenStream){const screenStream=activeScreenStream;activeScreenStream=null;screenStream.getTracks().forEach(track=>track.stop())}callPeers.forEach(peer=>peer.connection.close());callPeers.clear();if(callChannel){const channel=callChannel;callChannel=null;const client=getSupabaseClient();if(client)client.removeChannel(channel).catch(error=>console.error("Unable to leave call channel:",error))}if(activeStream){activeStream.getTracks().forEach(track=>track.stop());activeStream=null}$("#localVideo").srcObject=null;$("#localVideoTile").classList.add("hidden");$$(".call-video-tile[id^='remote-']").forEach(tile=>tile.remove());$("#cameraBtn").textContent="Turn camera off";$("#micBtn").textContent="Mute microphone";$("#shareBtn").textContent="Share screen";setCallButtons(false)}
document.addEventListener("click",event=>{const trigger=event.target.closest("[data-room],[data-call]");if(!trigger)return;const session=data.sessions.find(item=>item.id===trigger.dataset.call);const groupId=trigger.dataset.room||session?.groupId;const group=data.groups.find(item=>item.id===groupId);if(group){$("#callRoomCode").value=group.code;liveKitRoomDisplayName=group.name;$("#callRoomName").textContent=group.name}else if(session){$("#callRoomCode").value=session.id.toUpperCase();liveKitRoomDisplayName=session.title||"Study Room";$("#callRoomName").textContent=liveKitRoomDisplayName}else if(trigger.dataset.room){$("#callRoomCode").value=trigger.dataset.room.toUpperCase();liveKitRoomDisplayName="Study Room";$("#callRoomName").textContent=liveKitRoomDisplayName}$("#callRoomCodeLabel").textContent=$("#callRoomCode").value.toUpperCase()||"—"},true);
$("#joinCallBtn").onclick=joinCall;
$("#cameraBtn").onclick=()=>{const track=activeStream?.getVideoTracks()[0];if(!track)return;track.enabled=!track.enabled;$("#cameraBtn").textContent=track.enabled?"Turn camera off":"Turn camera on"};
$("#micBtn").onclick=()=>{const track=activeStream?.getAudioTracks()[0];if(!track)return;track.enabled=!track.enabled;$("#micBtn").textContent=track.enabled?"Mute microphone":"Unmute microphone"};
$("#shareBtn").onclick=async()=>{if(activeScreenStream){await stopScreenSharing();return}try{activeScreenStream=await navigator.mediaDevices.getDisplayMedia({video:true});const track=activeScreenStream.getVideoTracks()[0];replaceOutgoingVideoTrack(track);$("#localVideo").srcObject=activeScreenStream;$("#shareBtn").textContent="Stop sharing";track.addEventListener("ended",()=>{if(activeScreenStream)stopScreenSharing().catch(error=>{console.error("Unable to restore camera after screen share:",error);setCallStatus("Unable to restore camera: "+error.message)})})}catch(error){setCallStatus("Screen share cancelled or unavailable: "+error.message)}};
$("#copyCallCodeBtn").onclick=async()=>{const code=$("#callRoomCode").value.trim().toUpperCase();if(!code){setCallStatus("Choose a group or enter a room code first.");return}try{await navigator.clipboard.writeText(code);setCallStatus("Room code copied. Share it only with people you trust.")}catch(error){console.error("Unable to copy room code:",error);setCallStatus("Could not copy the room code. Select and copy it manually.")}};
let liveKitRoom=null, liveKitSdk=null, liveKitAttempt=0, liveKitCameraEnabled=false, liveKitMicEnabled=false, liveKitScreenEnabled=false, liveKitSpeakerEnabled=true;
let liveKitRoomDisplayName="Study Room";
const liveKitRemoteTracks=new Map(), liveKitRemoteAudio=new Map(), liveKitLocalScreenTiles=new Map();
$("#callRoomCode").addEventListener("input",()=>{const code=$("#callRoomCode").value.trim().toUpperCase();$("#callRoomCodeLabel").textContent=code||"—";const group=data.groups.find(item=>item.code.toUpperCase()===code);liveKitRoomDisplayName=group?.name||"Study Room";$("#callRoomName").textContent=liveKitRoomDisplayName});
function setLiveKitCallButtons(connected,joining=false){$("#joinCallBtn").disabled=connected||joining;$("#cameraBtn").disabled=!connected;$("#micBtn").disabled=!connected;$("#speakerBtn").disabled=!connected;$("#shareBtn").disabled=!connected;$("#leaveStudyRoomBtn").disabled=!connected&&!joining}
function setCallStatus(message,state){$("#callStatus").textContent=message;const indicator=$("#callLiveIndicator");if(!indicator)return;const callState=state||(!liveKitRoom?"idle":/error|could not|unavailable|disconnected/i.test(message)?"error":/connecting|joining/i.test(message)?"connecting":"live");indicator.dataset.state=callState;$("#callLiveText").textContent=callState==="live"?"LIVE":callState==="connecting"?"Connecting":callState==="error"?"Call issue":"Not connected"}
function updateCallParticipantCount(){const count=liveKitRoom?liveKitRoom.remoteParticipants.size+1:0;$("#callParticipantCount").textContent=`${count} ${count===1?"student":"students"}`}
function clearLiveKitTiles(){liveKitRemoteTracks.forEach(({tile,track})=>{track.detach();tile.remove()});liveKitRemoteTracks.clear();liveKitRemoteAudio.forEach(({audio,track})=>{track.detach(audio);audio.remove()});liveKitRemoteAudio.clear();liveKitLocalScreenTiles.forEach(({tile,track})=>{track.detach();tile.remove()});liveKitLocalScreenTiles.clear();$("#localVideo").srcObject=null;$("#localVideo").classList.add("hidden");$("#localVideoTile").classList.add("hidden");updateCallParticipantCount()}
function createLiveKitVideoTile(key,label){let tile=document.createElement("div");tile.className="call-video-tile";tile.dataset.livekitTile=key;const video=document.createElement("video");video.autoplay=true;video.playsInline=true;const caption=document.createElement("span");caption.textContent=label;tile.append(video,caption);$("#callVideoGrid").append(tile);return{tile,video}}
function handleLiveKitRemoteTrack(track,publication,participant){if(track.kind==="audio"){const audio=track.attach();audio.autoplay=true;audio.muted=!liveKitSpeakerEnabled;audio.dataset.livekitTrack=publication.trackSid||track.sid;document.body.append(audio);liveKitRemoteAudio.set(track.sid,{audio,track});return}if(track.kind!=="video")return;const source=publication.source==="screen_share"?"screen":"camera";const name=participant.name||"Participant";const {tile,video}=createLiveKitVideoTile(`remote-${track.sid}`,source==="screen"?`${name} · Screen`:`${name} · Camera`);track.attach(video);liveKitRemoteTracks.set(track.sid,{tile,track})}
function handleLiveKitLocalTrack(publication){const track=publication.track;if(!track||track.kind!=="video")return;if(publication.source==="screen_share"){const {tile,video}=createLiveKitVideoTile(`local-screen-${track.sid}`,`${data.name||"You"} · Screen`);video.muted=true;track.attach(video);liveKitLocalScreenTiles.set(track.sid,{tile,track});return}if(publication.source==="camera"){const video=$("#localVideo");video.classList.remove("hidden");$("#localVideoTile").classList.remove("hidden");track.attach(video)}}
async function joinLiveKitCall(){
  if(liveKitRoom)return;
  const roomCode=$("#callRoomCode").value.trim().toUpperCase();
  if(!/^[A-Z0-9-]{4,64}$/.test(roomCode)){setCallStatus("Enter a valid room code (4–64 letters, numbers, or hyphens).","error");return}
  const client=getSupabaseClient();
  if(!client){setCallStatus("Supabase is unavailable. Check your connection and configuration.","error");return}
  const attempt=++liveKitAttempt;
  setLiveKitCallButtons(false,true);
  setCallStatus("Connecting to the secure call service…","connecting");
  let room=null;
  try{
    await loadMyGroups();
    const group=data.groups.find(item=>item.code?.toUpperCase()===roomCode);
    if(!group)throw new Error("Join this study group before opening its call room.");
    liveKitRoomDisplayName=group.name;
    $("#callRoomName").textContent=group.name;
    $("#callRoomCodeLabel").textContent=group.code;
    if(!liveKitSdk)liveKitSdk=await import("https://esm.sh/livekit-client@2.19.1?bundle");
    if(attempt!==liveKitAttempt)return;
    const {data:sessionData,error:sessionError}=await client.auth.getSession();
    if(sessionError)throw sessionError;
    if(!sessionData.session)throw new Error("Log in before joining a call.");
    if(attempt!==liveKitAttempt)return;
    const {data:tokenData,error:tokenError}=await client.functions.invoke("create-livekit-token",{body:{groupId:group.id,participantName:data.name||"Student"}});
    if(tokenError)throw new Error(tokenError.message||"Could not get a LiveKit token.");
    if(!tokenData?.token)throw new Error("Token service returned no call token.");
    if(attempt!==liveKitAttempt)return;
    const {Room,RoomEvent}=liveKitSdk;
    room=new Room({adaptiveStream:true,dynacast:true});
    liveKitRoom=room;
    room.on(RoomEvent.TrackSubscribed,(track,publication,participant)=>handleLiveKitRemoteTrack(track,publication,participant));
    room.on(RoomEvent.TrackUnsubscribed,(track,publication)=>{
      if(track.kind==="audio"){
        const entry=liveKitRemoteAudio.get(track.sid);
        if(entry){track.detach(entry.audio);entry.audio.remove();liveKitRemoteAudio.delete(track.sid)}
      }else if(track.kind==="video"){
        const entry=liveKitRemoteTracks.get(track.sid);
        if(entry){track.detach();entry.tile.remove();liveKitRemoteTracks.delete(track.sid)}
      }
    });
    room.on(RoomEvent.LocalTrackPublished,publication=>handleLiveKitLocalTrack(publication));
    room.on(RoomEvent.LocalTrackUnpublished,publication=>{
      const track=publication.track;
      if(!track)return;
      if(publication.source==="screen_share"){
        const entry=liveKitLocalScreenTiles.get(track.sid);
        if(entry){track.detach();entry.tile.remove();liveKitLocalScreenTiles.delete(track.sid)}
      }else if(publication.source==="camera"){
        track.detach($("#localVideo"));
        $("#localVideo").classList.add("hidden");
      }
    });
    room.on(RoomEvent.ParticipantConnected,()=>{
      updateCallParticipantCount();
      setCallStatus(`${liveKitRoomDisplayName} · ${room.remoteParticipants.size} other participant${room.remoteParticipants.size===1?"":"s"} connected.`);
    });
    room.on(RoomEvent.ParticipantDisconnected,()=>{
      updateCallParticipantCount();
      setCallStatus(room.remoteParticipants.size?`${liveKitRoomDisplayName} · ${room.remoteParticipants.size} other participant${room.remoteParticipants.size===1?"":"s"} connected.`:"You are the only student in this room.");
    });
    room.on(RoomEvent.Disconnected,()=>{
      if(liveKitRoom===room){
        liveKitRoom=null;
        clearLiveKitTiles();
        setLiveKitCallButtons(false);
        setCallStatus("Disconnected from the call.","idle");
      }
    });
    setCallStatus("Joining room…","connecting");
    await room.connect(LIVEKIT_SERVER_URL,tokenData.token);
    if(attempt!==liveKitAttempt){await room.disconnect();return}

    const mediaIssues=[];
    try{
      await room.localParticipant.setMicrophoneEnabled(true);
      liveKitMicEnabled=true;
    }catch(error){
      liveKitMicEnabled=false;
      mediaIssues.push("Microphone unavailable");
      console.error("Unable to start LiveKit microphone:",error);
    }
    try{
      await room.localParticipant.setCameraEnabled(true);
      liveKitCameraEnabled=true;
    }catch(error){
      liveKitCameraEnabled=false;
      mediaIssues.push("Camera unavailable");
      console.error("Unable to start LiveKit camera:",error);
    }
    liveKitScreenEnabled=false;
    liveKitSpeakerEnabled=true;
    $("#cameraBtn").textContent=liveKitCameraEnabled?"Turn camera off":"Turn camera on";
    $("#micBtn").textContent=liveKitMicEnabled?"Mute microphone":"Unmute microphone";
    $("#speakerBtn").textContent="Speaker on";
    $("#shareBtn").textContent="Share screen";
    setLiveKitCallButtons(true);
    updateCallParticipantCount();
    const count=room.remoteParticipants.size;
    let status=count?`${liveKitRoomDisplayName} · ${count} other participant${count===1?"":"s"} connected.`:`${liveKitRoomDisplayName} is open. Waiting for other students…`;
    if(mediaIssues.length)status+=` ${mediaIssues.join(" and ")}. You're still in the call and can listen.`;
    setCallStatus(status,"live");
  }catch(error){
    console.error("Unable to join LiveKit call:",error);
    if(room){room.removeAllListeners();await room.disconnect().catch(disconnectError=>console.error("Unable to disconnect failed LiveKit room:",disconnectError))}
    if(liveKitRoom===room)liveKitRoom=null;
    clearLiveKitTiles();
    setLiveKitCallButtons(false);
    if(attempt===liveKitAttempt)setCallStatus("Could not join call: "+error.message,"error");
  }
}
async function leaveLiveKitCall(){liveKitAttempt++;const room=liveKitRoom;liveKitRoom=null;liveKitScreenEnabled=false;let disconnectError=null;if(room){room.removeAllListeners();try{await room.disconnect()}catch(error){disconnectError=error;console.error("LiveKit disconnect failed:",error)}}clearLiveKitTiles();liveKitCameraEnabled=false;liveKitMicEnabled=false;liveKitSpeakerEnabled=true;$("#cameraBtn").textContent="Turn camera on";$("#micBtn").textContent="Unmute microphone";$("#speakerBtn").textContent="Speaker on";$("#shareBtn").textContent="Share screen";setLiveKitCallButtons(false);setCallStatus(disconnectError?"Call left, but the connection did not close cleanly.":"Enter a room code and join to start a call.","idle");if(disconnectError)throw disconnectError}
$("#joinCallBtn").onclick=joinLiveKitCall;
$("#cameraBtn").onclick=async()=>{if(!liveKitRoom)return;try{liveKitCameraEnabled=!liveKitCameraEnabled;await liveKitRoom.localParticipant.setCameraEnabled(liveKitCameraEnabled);$("#cameraBtn").textContent=liveKitCameraEnabled?"Turn camera off":"Turn camera on"}catch(error){liveKitCameraEnabled=!liveKitCameraEnabled;console.error("Unable to toggle LiveKit camera:",error);setCallStatus("Camera error: "+error.message)}};
$("#micBtn").onclick=async()=>{if(!liveKitRoom)return;try{liveKitMicEnabled=!liveKitMicEnabled;await liveKitRoom.localParticipant.setMicrophoneEnabled(liveKitMicEnabled);$("#micBtn").textContent=liveKitMicEnabled?"Mute microphone":"Unmute microphone"}catch(error){liveKitMicEnabled=!liveKitMicEnabled;console.error("Unable to toggle LiveKit microphone:",error);setCallStatus("Microphone error: "+error.message)}};
$("#speakerBtn").onclick=()=>{if(!liveKitRoom)return;liveKitSpeakerEnabled=!liveKitSpeakerEnabled;liveKitRemoteAudio.forEach(({audio})=>{audio.muted=!liveKitSpeakerEnabled});$("#speakerBtn").textContent=liveKitSpeakerEnabled?"Speaker on":"Speaker off"};
$("#shareBtn").onclick=async()=>{if(!liveKitRoom)return;try{liveKitScreenEnabled=!liveKitScreenEnabled;await liveKitRoom.localParticipant.setScreenShareEnabled(liveKitScreenEnabled);$("#shareBtn").textContent=liveKitScreenEnabled?"Stop sharing":"Share screen"}catch(error){liveKitScreenEnabled=!liveKitScreenEnabled;console.error("Unable to toggle LiveKit screen share:",error);setCallStatus("Screen share unavailable: "+error.message)}};
$("#leaveStudyRoomBtn").onclick=async()=>{try{await leaveLiveKitCall();closeDialog("callDialog")}catch(error){console.error("Unable to leave LiveKit call:",error);setCallStatus("Could not leave call cleanly: "+error.message,"error")}};
$("#callDialog").addEventListener("close",()=>{leaveLiveKitCall().catch(error=>{console.error("Unable to leave LiveKit call:",error);setCallStatus("Could not leave call cleanly: "+error.message,"error")})});
renderAll();setTimerDisplay();updateProfileUI();
