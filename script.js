// script.js の全体のコード



// JSONファイルのパス（index.htmlと同じディレクトリにjikokuhyo.jsonがある場合）

const JSON_FILE_PATH = 'jikokuhyo.json';



// HTML要素の取得（初期はnullで宣言し、DOMContentLoadedで確実に取得する）

let mainDisplayArea = null;

let stopStationsDisplayArea = null;



// ★★★ ここから追加する変数宣言（既存ならそのまま） ★★★

let currentApproachingTrain = null; // 現在点滅表示中の列車

let approachingTimer = null; // 点滅を管理するタイマーID (今回は主に状態管理に使用)

const APPROACHING_START_MINUTES_BEFORE = 1; // 発車時刻の何分前から点滅開始するか

const APPROACHING_END_MINUTES_AFTER = 1; // 発車時刻の何分後まで点滅継続するか



// ★★★ 新しく追加する変数 ★★★

let stopStationsSpanElement = null; // 停車駅表示用のspan要素への参照

let cachedOriginalStopStationsHtml = ''; // 元の停車駅HTMLをキャッシュするための変数

// ★★★ ここまで追加する変数宣言 ★★★



// 日本語から英語へのマッピングオブジェクト (英語表示を使わないなら削除してもOKですが、残しておきます)

const englishMappings = {

// 列車の種別

"type": {

"普通": "Local",

"快速": "Rapid",

"特急": "Limited Express",

"特急ソニック": "Limited Express Sonic",

"特急きらめき": "Limited Express Kirameki",

"にちりんシーガイア": "Nichirin-Seagaia",

},

// 行き先

"destination": {

"門司港": "Mojiko",

"小倉": "Kokura",

"大分": "Oita",

"博多": "Hakata",

"熊本": "Kumamoto",

"鹿児島中央": "Kagoshima-Chuo",

"下関": "Shimonoseki",

}

};



/**

* 時刻を比較し、指定した時刻が現在の時刻に近いかどうかを判定するヘルパー関数

* @param {string} trainTimeStr - 列車時刻文字列 (HH:MM)

* @param {number} startOffsetMinutes - 開始オフセット (分)

* @param {number} endOffsetMinutes - 終了オフセット (分)

* @param {Date} now - 現在のDateオブジェクト

* @returns {boolean} - 判定結果

*/

function isTrainApproaching(trainTimeStr, startOffsetMinutes, endOffsetMinutes, now) {

const [trainHour, trainMinute] = trainTimeStr.split(':').map(Number);

const trainDateTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), trainHour, trainMinute, 0);



const startTime = new Date(trainDateTime.getTime() - startOffsetMinutes * 60 * 1000);

const endTime = new Date(trainDateTime.getTime() + endOffsetMinutes * 60 * 1000);



return now >= startTime && now <= endTime;

}



/**

* 現在の時刻に基づいて、表示すべき時刻表のデータを取得する

* JSONに現在時刻以降の列車がない場合、次の日の始発を表示する

* @param {Object} timetableData - JSONから読み込んだ時刻表データ全体

* @returns {Object} - フィルターされた列車、曜日タイプ、最も近い次の列車

*/

function getTrainsForCurrentTime(timetableData) {

const now = new Date();

const currentHour = now.getHours();

const currentMinute = now.getMinutes();

const dayOfWeek = now.getDay();



let currentTimetable;

let timetableType = '';



if ((dayOfWeek === 0 || dayOfWeek === 6) && timetableData.timetable.holidays && timetableData.timetable.holidays.length > 0) {

currentTimetable = timetableData.timetable.holidays;

timetableType = '(休日)';

} else {

currentTimetable = timetableData.timetable.weekdays;

timetableType = '(平日)';

}



console.log('--- getTrainsForCurrentTime 関数デバッグ情報 ---');

console.log('現在のシステム時刻:', now.getHours(), '時', now.getMinutes(), '分', now.getSeconds(), '秒');

console.log('現在の曜日 (0=日, 1=月, ..., 6=土):', dayOfWeek);

console.log('選択された時刻表タイプ:', timetableType);

console.log('フィルター前の列車データ（currentTimetable）:', currentTimetable);

console.log('フィルター前の列車数:', currentTimetable ? currentTimetable.length : 'データなし');



const upcomingTrains = currentTimetable ? currentTimetable.filter(train => {

const [trainHour, trainMinute] = train.time.split(':').map(Number);

const trainDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), trainHour, trainMinute, 0);


if (currentApproachingTrain &&

train.time === currentApproachingTrain.time &&

train.destination === currentApproachingTrain.destination &&

train.type === currentApproachingTrain.type) {

return true;

}



return trainDate.getTime() >= now.getTime();

}).sort((a, b) => {

const [hourA, minuteA] = a.time.split(':').map(Number);

const [hourB, minuteB] = b.time.split(':').map(Number);

if (hourA !== hourB) return hourA - hourB;

return minuteA - minuteB;

}) : [];



console.log('フィルター後のupcomingTrains:', upcomingTrains);

console.log('フィルター後のupcomingTrains数:', upcomingTrains.length);



let trainsToDisplay = upcomingTrains;

let firstUpcomingTrain = upcomingTrains.length > 0 ? upcomingTrains[0] : null;



if (upcomingTrains.length === 0) {

if (currentTimetable && currentTimetable.length > 0) {

const nextDayFirstTrain = currentTimetable[0];

trainsToDisplay = [nextDayFirstTrain];

firstUpcomingTrain = nextDayFirstTrain;

console.log('現在時刻以降の列車がないため、次の日の始発を表示します:', nextDayFirstTrain);

} else {

trainsToDisplay = [];

firstUpcomingTrain = null;

console.log('時刻表データが空のため、表示する列車がありません。');

}

}



console.log('最終的に表示に選ばれた列車データ（trainsToDisplay）:', trainsToDisplay);

console.log('最終的に表示に選ばれた列車数:', trainsToDisplay ? trainsToDisplay.length : 'データなし');

console.log('最初に表示される列車（firstUpcomingTrain）:', firstUpcomingTrain);

console.log('--- getTrainsForCurrentTime 関数デバッグ情報 終了 ---');



return {

trains: trainsToDisplay,

type: timetableType,

firstUpcomingTrain: firstUpcomingTrain

};

}





/**

* データを読み込み、電光掲示板の表示を更新する

*/

async function loadAndDisplayTimetable() {

try {

mainDisplayArea = document.getElementById('main-display-area');

stopStationsDisplayArea = document.getElementById('stop-stations-display-area');



if (!mainDisplayArea || !stopStationsDisplayArea) {

console.error('必須のHTML要素（mainDisplayAreaまたはstopStationsDisplayArea）が見つかりません。HTMLファイルを確認してください。');

return;

}



const response = await fetch(JSON_FILE_PATH);



if (!response.ok) {

throw new Error(`HTTP error! status: ${response.status} - ${response.url}`);

}



const data = await response.json();



console.log('JSONデータが正常に読み込まれました:', data);



const now = new Date();



const { trains, type: timetableType, firstUpcomingTrain } = getTrainsForCurrentTime(data);



// --- メイン表示（時刻表）の生成 ---

let mainHtmlContent = '';



if (trains && trains.length > 0) {

const displayTrain = trains[0];

const trainType = displayTrain.type;



let typeClass = '';

if (trainType.includes('普通')) {

typeClass = 'normal';

} else if (trainType.includes('快速')) {

typeClass = 'rapid';

} else if (trainType.includes('特急') || trainType.includes('にちりんシーガイア')) {

typeClass = 'limited-express';

}



mainHtmlContent = `

<div class="train-row">

<span class="train-type ${typeClass}">${displayTrain.type}</span> <span class="train-time">${displayTrain.time}</span>

<span class="train-destination">${displayTrain.destination}</span>

${displayTrain.delay ? `<span class="train-delay">${displayTrain.delay}</span>` : ''}

</div>

`;

} else {

mainHtmlContent += `<div class="train-row no-trains"><span>現在、この曜日の時刻表データはありません。</span></div>`;

}



mainDisplayArea.innerHTML = mainHtmlContent;



// --- 停車駅表示の生成 ---

// このoriginalStopStationsHtmlは、あくまで文字列としてのHTMLを生成

let currentOriginalStopStationsHtml = '';

let currentTrainTypeKey = '普通';

let displayTrainType = '列車';



if (firstUpcomingTrain) {

const originalTrainType = firstUpcomingTrain.type;

displayTrainType = originalTrainType;



if (originalTrainType.includes('普通')) {

currentTrainTypeKey = '普通';

} else if (originalTrainType.includes('快速')) {

currentTrainTypeKey = '快速';

} else if (originalTrainType.includes('特急') || originalTrainType.includes('にちりんシーガイア')) {

currentTrainTypeKey = '特急';

} else {

currentTrainTypeKey = '普通';

}

} else {

currentTrainTypeKey = '普通';

displayTrainType = '列車';

}



const stopStations = data.stopStations ? data.stopStations[currentTrainTypeKey] : undefined;



if (stopStations && Array.isArray(stopStations) && stopStations.length > 0) {

const targetStationToHighlight = firstUpcomingTrain ? firstUpcomingTrain.destination : null;



const coloredStopStations = stopStations.map(station => {

if (targetStationToHighlight && station === targetStationToHighlight) {

return `<span class="highlighted-station">${station}</span>`;

}

return station;

}).join('・');



if (firstUpcomingTrain) {

currentOriginalStopStationsHtml = `先発の ${displayTrainType} ${firstUpcomingTrain.destination} 行きの小倉までの停車駅は、${coloredStopStations} です。`;

} else {

currentOriginalStopStationsHtml = `小倉までの停車駅は、${coloredStopStations} です。`;

}

} else {

currentOriginalStopStationsHtml = `【${displayTrainType}】停車駅情報は登録されていません。　`;

}



// --- 点滅ロジックを停車駅表示エリアに適用 ---

let showApproachingMessage = false;



if (currentApproachingTrain) {

if (isTrainApproaching(currentApproachingTrain.time, APPROACHING_START_MINUTES_BEFORE, APPROACHING_END_MINUTES_AFTER, now)) {

showApproachingMessage = true;

console.log('停車駅表示: 既存の点滅列車がまだ点滅期間中です:', currentApproachingTrain.time);

} else {

currentApproachingTrain = null;

console.log('停車駅表示: 点滅期間が終了しました。');

}

}



if (!currentApproachingTrain && firstUpcomingTrain) {

if (isTrainApproaching(firstUpcomingTrain.time, APPROACHING_START_MINUTES_BEFORE, APPROACHING_END_MINUTES_AFTER, now)) {

showApproachingMessage = true;

currentApproachingTrain = firstUpcomingTrain;

console.log('停車駅表示: 新たな点滅列車を検出しました:', firstUpcomingTrain.time);

}

}


// 停車駅表示エリアの最初の span 要素を取得し、操作する

// 初回のみ、またはHTMLにspanがない場合のみ作成

if (!stopStationsSpanElement) {

stopStationsSpanElement = stopStationsDisplayArea.querySelector('span');

if (!stopStationsSpanElement) {

stopStationsSpanElement = document.createElement('span');

stopStationsDisplayArea.appendChild(stopStationsSpanElement);

}

// 初回ロード時に元の停車駅表示の内容をキャッシュ

cachedOriginalStopStationsHtml = stopStationsSpanElement.innerHTML; // 初期のHTML内容をキャッシュ

}



// 停車駅のHTMLが更新された場合のみキャッシュを更新

if (cachedOriginalStopStationsHtml === '' || cachedOriginalStopStationsHtml !== currentOriginalStopStationsHtml) {

cachedOriginalStopStationsHtml = currentOriginalStopStationsHtml;

// 通常表示時のtextContentもここで更新

if (!showApproachingMessage) { // 点滅中でなければ、ここで通常のテキストを設定

stopStationsSpanElement.innerHTML = cachedOriginalStopStationsHtml;

}

}





if (showApproachingMessage) {

// 点滅メッセージを設定

stopStationsSpanElement.textContent = '列車がまいります';

// 点滅クラスを追加し、スクロールアニメーションを停止する

stopStationsSpanElement.classList.add('approaching-message');

// 既存のanimationをnoneで上書きするため、スタイルを直接変更

stopStationsSpanElement.style.animation = 'none';

stopStationsSpanElement.style.transform = 'translateX(0)'; // 中央に固定

stopStationsSpanElement.style.textAlign = 'center'; // テキストを中央寄せ

stopStationsSpanElement.style.display = 'block'; // text-align: centerが効くように

} else {

// 元の停車駅表示に戻す

stopStationsSpanElement.innerHTML = cachedOriginalStopStationsHtml;

// 点滅クラスを削除し、スクロールアニメーションを再開する

stopStationsSpanElement.classList.remove('approaching-message');

// styleプロパティをリセットしてCSSのルール（スクロールアニメーション）を再度適用させる

stopStationsSpanElement.style.animation = ''; // CSSのanimationプロパティに戻す

stopStationsSpanElement.style.transform = ''; // CSSのtransformプロパティに戻す

stopStationsSpanElement.style.textAlign = ''; // テキストアラインをリセット

stopStationsSpanElement.style.display = ''; // displayをリセット

}



} catch (error) {

console.error('時刻表データの読み込みまたは表示中にエラーが発生しました:', error);

if (mainDisplayArea) mainDisplayArea.innerHTML = '<span>データの読み込みに失敗しました。コンソールを確認してください。</span>';

if (stopStationsDisplayArea) stopStationsDisplayArea.innerHTML = '<span>エラーが発生しました。</span>';

}

}





// ページが完全に読み込まれたら時刻表表示関数を実行

document.addEventListener('DOMContentLoaded', loadAndDisplayTimetable);



// オプション: 定期的に表示を更新したい場合（例: 1分ごと）

// これを有効にすると、1分ごとに列車が更新され、次の列車が表示されるようになります

setInterval(loadAndDisplayTimetable, 1000); // ★★★ テスト用に1秒にしています。動作確認後は「60 * 1000」に戻してください ★★★
