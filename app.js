const $ = (id) => document.getElementById(id);
const TOTAL = 300, PER_LESSON = 50, STORE_KEY = 'reaQuizProgress_v1';
let bank = [], state = loadState(), activeLesson = 0, queue = [], cursor = 0, session = [], selected = null, toastTimer;

function loadState(){
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {answers:{}, completed:{}}; }
  catch { return {answers:{}, completed:{}}; }
}
function saveState(){ localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
function showToast(msg){
  const el=$('toast'); el.textContent=msg; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),2100);
}
function screen(name){
  ['homeScreen','quizScreen','resultScreen'].forEach(id=>$(id).classList.toggle('hidden',id!==name));
  window.scrollTo({top:0,behavior:'smooth'});
}
function lessonQuestions(n){ return bank.slice(n*PER_LESSON,(n+1)*PER_LESSON); }
function lessonStats(n){
  const qs=lessonQuestions(n); let done=0,correct=0;
  qs.forEach(q=>{const a=state.answers[q.number];if(a){done++;if(a.correct)correct++;}});
  return {done,correct,wrong:done-correct};
}
function renderHome(){
  const done=Object.keys(state.answers).length;
  $('overallDone').textContent=`${done} из ${TOTAL} пройдено`;
  $('overallPercent').textContent=`${Math.round(done/TOTAL*100)}%`;
  $('overallBar').style.width=`${done/TOTAL*100}%`;
  $('lessons').innerHTML='';
  for(let n=0;n<6;n++){
    const s=lessonStats(n), pct=Math.round(s.done/PER_LESSON*100);
    const card=document.createElement('button'); card.className='lesson-card';
    card.innerHTML=`<div class="lesson-head"><span class="lesson-num">ЗАНЯТИЕ ${n+1}</span><span class="lesson-arrow">›</span></div>
      <strong>${n*50+1}–${(n+1)*50}</strong><span class="lesson-range">50 вопросов</span>
      <div class="mini-track"><span style="width:${pct}%"></span></div>
      <div class="lesson-status"><span>${s.done}/50 пройдено</span><span>${s.correct} верно</span></div>`;
    card.addEventListener('click',()=>startLesson(n)); $('lessons').appendChild(card);
  }
}
function startLesson(n, onlyMistakes=false){
  activeLesson=n;
  const qs=lessonQuestions(n);
  queue=onlyMistakes?qs.filter(q=>state.answers[q.number]&&!state.answers[q.number].correct):qs.slice();
  if(!queue.length){showToast('Ошибок для повторения нет');return;}
  cursor=0; session=[]; screen('quizScreen'); renderQuestion();
}
function renderQuestion(){
  selected=null;
  const q=queue[cursor], saved=state.answers[q.number];
  $('lessonChip').textContent=`Занятие ${activeLesson+1}`;
  $('questionNumber').textContent=`ВОПРОС ${q.number}`;
  $('questionId').textContent=q.id;
  $('questionText').textContent=q.question;
  $('progressText').textContent=`${cursor+1} / ${queue.length}`;
  $('lessonBar').style.width=`${cursor/queue.length*100}%`;
  const counts=session.reduce((a,x)=>{x.correct?a.correct++:a.wrong++;return a;},{correct:0,wrong:0});
  $('correctCount').textContent=counts.correct;
  $('wrongCount').textContent=counts.wrong;
  $('remainingCount').textContent=`${queue.length-cursor} осталось`;
  $('answers').innerHTML='';
  $('feedback').className='feedback hidden'; $('feedback').textContent='';
  $('nextBtn').disabled=true;
  const labels=['A','B','C','D'];
  q.options.forEach((option,i)=>{
    const btn=document.createElement('button'); btn.className='answer';
    btn.innerHTML=`<span class="answer-letter">${labels[i]}</span><span></span>`;
    btn.querySelector('span:last-child').textContent=option;
    btn.addEventListener('click',()=>chooseAnswer(i));
    $('answers').appendChild(btn);
  });
  if(saved && !queue._mistakeMode){ /* unanswered sessions remain interactive; previous answers are shown only in review */ }
  $('nextBtn').textContent=cursor===queue.length-1?'Посмотреть результат':'Следующий вопрос';
}
function chooseAnswer(index){
  if(selected!==null)return;
  selected=index;
  const q=queue[cursor], ok=index===q.correct;
  session.push({q,selected:index,correct:ok});
  // Persist the latest attempt for the question.
  state.answers[q.number]={selected:index,correct:ok};
  saveState();
  [...$('answers').children].forEach((btn,i)=>{
    btn.disabled=true;
    if(i===q.correct)btn.classList.add('correct');
    else if(i===index)btn.classList.add('incorrect');
    else btn.classList.add('muted');
  });
  const fb=$('feedback'); fb.className=`feedback ${ok?'good':'bad'}`;
  fb.textContent=ok?'✓ Верно! Отличная работа.':`✕ Неверно. Правильный ответ: ${q.options[q.correct]}`;
  $('nextBtn').disabled=false;
  const counts=session.reduce((a,x)=>{x.correct?a.correct++:a.wrong++;return a;},{correct:0,wrong:0});
  $('correctCount').textContent=counts.correct;
  $('wrongCount').textContent=counts.wrong;
  $('remainingCount').textContent=`${queue.length-cursor-1} осталось`;
  $('lessonBar').style.width=`${(cursor+1)/queue.length*100}%`;
}
function nextQuestion(){
  if(selected===null)return;
  if(cursor<queue.length-1){cursor++;renderQuestion();}
  else finishLesson();
}
function finishLesson(){
  const mistakes=session.filter(x=>!x.correct);
  const correct=session.length-mistakes.length;
  const pct=session.length?Math.round(correct/session.length*100):0;
  state.completed[activeLesson]={lastPercent:pct,at:Date.now()};
  saveState();
  $('resultScore').textContent=`${correct}/${session.length}`;
  $('resultCorrect').textContent=correct;
  $('resultWrong').textContent=mistakes.length;
  $('resultPercent').textContent=`${pct}%`;
  $('resultTitle').textContent=pct>=90?'Превосходно!':pct>=70?'Хорошая работа!':pct>=50?'Есть прогресс!':'Продолжай тренироваться';
  $('resultSummary').textContent=`Ты ответил(а) правильно на ${correct} из ${session.length} вопросов.`;
  $('resultIcon').textContent=pct>=70?'✓':'↗';
  $('mistakeLabel').textContent=`${mistakes.length} вопросов`;
  $('mistakes').innerHTML='';
  if(!mistakes.length){$('mistakes').innerHTML='<div class="no-mistakes">Отлично! В этом прохождении ошибок нет.</div>';}
  mistakes.forEach(({q,selected})=>{
    const div=document.createElement('div');div.className='mistake-card';
    div.innerHTML=`<div class="mistake-q">${q.number}. ${escapeHtml(q.question)}</div>
      <div class="mistake-answer bad"><b>Твой ответ:</b> ${escapeHtml(q.options[selected])}</div>
      <div class="mistake-answer good"><b>Правильный ответ:</b> ${escapeHtml(q.options[q.correct])}</div>`;
    $('mistakes').appendChild(div);
  });
  $('retryMistakesBtn').disabled=mistakes.length===0;
  $('retryMistakesBtn').style.opacity=mistakes.length===0?'.45':'1';
  screen('resultScreen');renderHome();
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function goHome(){renderHome();screen('homeScreen');}
$('nextBtn').addEventListener('click',nextQuestion);
$('backBtn').addEventListener('click',goHome);
$('resultHomeBtn').addEventListener('click',goHome);
$('resultHomeBtn2').addEventListener('click',goHome);
$('homeLink').addEventListener('click',e=>{e.preventDefault();goHome();});
$('finishBtn').addEventListener('click',()=>{if(session.length)finishLesson();else goHome();});
$('retryBtn').addEventListener('click',()=>startLesson(activeLesson));
$('retryMistakesBtn').addEventListener('click',()=>startLesson(activeLesson,true));
$('resetAllBtn').addEventListener('click',()=>{
  if(confirm('Сбросить весь сохранённый прогресс?')){state={answers:{},completed:{}};saveState();renderHome();showToast('Прогресс сброшен');}
});
fetch('questions.json').then(r=>{if(!r.ok)throw new Error('Не удалось загрузить вопросы');return r.json();})
.then(data=>{bank=data;if(bank.length!==300)throw new Error('В файле должно быть 300 вопросов');renderHome();})
.catch(err=>{document.querySelector('.app').innerHTML=`<div style="padding:30px 0"><h2>Не удалось загрузить вопросы</h2><p>${err.message}. Проверь, что questions.json загружен вместе с сайтом.</p></div>`;});
