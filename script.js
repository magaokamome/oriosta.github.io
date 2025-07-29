// script.js の全体のコード

// JSONファイルのパス（index.htmlと同じディレクトリにjikokuhyo.jsonがある場合）
const JSON_FILE_PATH = 'jikokuhyo.json';

// HTML要素の取得（初期はnullで宣言し、DOMContentLoadedで確実に取得する）
let mainDisplayArea = null;
let stopStationsDisplayArea = null;
let infoScrollingText = null; // 緑色のスクロールエリアの要素
let scrollingAreaElement = null; // scrolling-area要素への参照

// スクロールアニメーションに干渉しないよう、不要な変数宣言を削除
let stopStationsSpanElement = null; // 停車駅表示用のspan要素への参照

// 日本語から英語へのマッピングオブジェクト
const englishMappings = {
    // 列車の種別
    "type": {
        "普通": "Local",
        "快速": "Rapid",
        "特急": "Limited Express",
        // 以下は、もしjikokuhyo.jsonにこれらの具体的な種別名がある場合のために残しておきますが、
        // 現行ロジックでは「特急」に集約されているため、直接は使われないかもしれません。
        "特急ソニック": "Limited Express Sonic", 
        "特急きらめき": "Limited Express Kirameki", 
        "にちりんシーガイア": "Nichirin-Seagaia", // これは特急に含まれる
    },
    // 行き先
    "destination": {
        "門司港": "Mojiko",
        "小倉": "Kokura",
        "中津": "Nakatsu",
        "佐伯": "Saiki",
        "黒崎": "Kurosaki",
        "大分": "Oita",
        "博多": "Hakata",
        "熊本": "Kumamoto",
        "鹿児島中央": "Kagoshima-Chuo",
        "下関": "Shimonoseki",
        // 他の行き先があればここに追加
    }
};

// ★追加：表示切り替えのための変数
let displayIntervalId = null; // setIntervalのIDを保持
let isEnglishDisplay = false; // 現在が英語表示か日本語表示かを示すフラグ

/**
 * 時刻を比較し、指定した時刻が現在の時刻に近いかどうかを判定するヘルパー関数
 * （現在は使用されていません）
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
 */
function getTrainsForCurrentTime(timetableData) {
    const now = new Date();
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

    const upcomingTrains = currentTimetable ? currentTimetable.filter(train => {
        const [trainHour, trainMinute] = train.time.split(':').map(Number);
        const trainDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), trainHour, trainMinute, 0);
        return trainDate.getTime() >= now.getTime();
    }).sort((a, b) => {
        const [hourA, minuteA] = a.time.split(':').map(Number);
        const [hourB, minuteB] = b.time.split(':').map(Number);
        if (hourA !== hourB) return hourA - hourB;
        return minuteA - minuteB;
    }) : [];

    let trainsToDisplay = upcomingTrains;
    let firstUpcomingTrain = upcomingTrains.length > 0 ? upcomingTrains[0] : null;

    if (upcomingTrains.length === 0) {
        if (currentTimetable && currentTimetable.length > 0) {
            const nextDayFirstTrain = currentTimetable[0];
            trainsToDisplay = [nextDayFirstTrain];
            firstUpcomingTrain = nextDayFirstTrain;
        } else {
            trainsToDisplay = [];
            firstUpcomingTrain = null;
        }
    }
    return {
        trains: trainsToDisplay,
        type: timetableType,
        firstUpcomingTrain: firstUpcomingTrain
    };
}


/**
 * メイン表示エリアのコンテンツを更新する関数
 * @param {Object} displayTrain - 表示する列車のデータオブジェクト
 * @param {boolean} showEnglish - trueなら英語、falseなら日本語を表示
 */
function updateMainDisplay(displayTrain, showEnglish) {
    if (!mainDisplayArea || !displayTrain) return;

    const trainType = displayTrain.type;
    const trainDestination = displayTrain.destination;
    const trainTime = displayTrain.time;
    const trainDelay = displayTrain.delay;

    let typeClass = '';
    if (trainType.includes('普通')) {
        typeClass = 'normal';
    } else if (trainType.includes('快速')) {
        typeClass = 'rapid';
    } else if (trainType.includes('特急') || trainType.includes('にちりんシーガイア')) {
        typeClass = 'limited-express';
    }

    let displayType = trainType;
    let displayDestination = trainDestination;

    // 英語表示に切り替える場合
    if (showEnglish) {
        if (englishMappings.type[trainType]) {
            displayType = englishMappings.type[trainType];
        } else if (trainType.includes('特急') && englishMappings.type['特急']) {
            // 特急の具体的な名称（例：特急ソニック）に直接マッピングがない場合、汎用特急を試す
            displayType = englishMappings.type['特急'];
        }
        
        if (englishMappings.destination[trainDestination]) {
            displayDestination = englishMappings.destination[trainDestination];
        }
    }

    // HTMLコンテンツを生成
    let mainHtmlContent = `
        <div class="train-row">
            <span class="train-type ${typeClass}">${displayType}</span> <span class="train-time">${trainTime}</span>
            <span class="train-destination">${displayDestination}</span>
            ${trainDelay ? `<span class="train-delay">${trainDelay}</span>` : ''}
        </div>
    `;
    mainDisplayArea.innerHTML = mainHtmlContent;
}


/**
 * データを読み込み、電光掲示板の表示を更新する
*/
async function loadAndDisplayTimetable() {
    try {
        mainDisplayArea = document.getElementById('main-display-area');
        stopStationsDisplayArea = document.getElementById('stop-stations-display-area');
        infoScrollingText = document.getElementById('info-scrolling-text');
        scrollingAreaElement = document.querySelector('.scrolling-area'); 

        // 必須要素のチェック
        if (!mainDisplayArea || !stopStationsDisplayArea || !infoScrollingText || !scrollingAreaElement) {
            console.error('必須のHTML要素が見つかりません。HTMLファイルを確認してください。');
            return;
        }

        const response = await fetch(JSON_FILE_PATH);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} - ${response.url}`);
        }

        const data = await response.json();

        const { trains, type: timetableType, firstUpcomingTrain } = getTrainsForCurrentTime(data); 

        // ★重要変更点：ここから - メイン表示の切り替えロジック
        // 既存のsetIntervalをクリア
        if (displayIntervalId) {
            clearInterval(displayIntervalId);
            displayIntervalId = null;
        }

        if (trains && trains.length > 0) {
            const displayTrain = trains[0];

            // 初回表示は日本語
            isEnglishDisplay = false; 
            updateMainDisplay(displayTrain, isEnglishDisplay);

            // 3秒ごとに表示を切り替えるインターバルを設定
            displayIntervalId = setInterval(() => {
                // ここでの「英語3秒、日本語6秒」の切り替えは、より複雑なロジックが必要になります。
                // 現状はシンプルに「切り替えるたびに状態を反転」させます。
                // 厳密な「3秒英語、6秒日本語」を実現するには、setTimeoutをネストするか、
                // より高度な状態管理が必要ですが、まずは切り替え自体を実装します。

                isEnglishDisplay = !isEnglishDisplay; // 状態を反転
                updateMainDisplay(displayTrain, isEnglishDisplay);

                // 次のインターバルまでの時間を設定し直す（再帰的にsetIntervalを呼び出すイメージ）
                // ただし、これだと常に同じ間隔になってしまうので、後述のより良い方法を検討
            }, 4000); // まずは3秒ごとに表示を更新する形で実装（英語/日本語が交互に3秒ずつ）
                      // 後で6秒日本語と3秒英語のロジックを調整します。
                      // このsetIntervalは単純に切り替えのトリガーとして使用

            // ★重要変更点：ここまで - メイン表示の切り替えロジック


            // ★★★ 停車駅表示のJavaScript更新ロジック (変更なし) ★★★
            if (!stopStationsSpanElement) {
                let currentOriginalStopStationsHtml = '';
                let currentTrainTypeKey = '普通'; 
                let displayTrainType = '列車';

                if (firstUpcomingTrain) {
                    const originalTrainType = firstUpcomingTrain.type;
                    displayTrainType = originalTrainType;

                    if (originalTrainType.includes('特急')) {
                        currentTrainTypeKey = '特急';
                    } else if (originalTrainType.includes('快速')) {
                        currentTrainTypeKey = '快速';
                    } else if (originalTrainType.includes('普通')) {
                        currentTrainTypeKey = '普通';
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

                    const filteredStopStations = stopStations.filter(station => station !== '小倉');
                    const cleanedStopStations = filteredStopStations.filter(station => station && station.trim() !== '');


                    const coloredStopStations = cleanedStopStations.map(station => {
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

                stopStationsSpanElement = stopStationsDisplayArea.querySelector('span');
                if (!stopStationsSpanElement) {
                    stopStationsSpanElement = document.createElement('span');
                    stopStationsDisplayArea.appendChild(stopStationsSpanElement);
                }
                stopStationsSpanElement.innerHTML = currentOriginalStopStationsHtml;
            }


            // ★★★ 緑のスクロールエリアにメインの列車の情報を挿入するロジック (変更なし) ★★★
            if (scrollingAreaElement && infoScrollingText) { 
                const now = new Date(); 

                const trainTypeForInfo = firstUpcomingTrain.type;
                const trainDestinationForInfo = firstUpcomingTrain.destination;
                const trainTime = firstUpcomingTrain.time;

                const [trainHour, trainMinute] = trainTime.split(':').map(Number);
                const trainDateTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), trainHour, trainMinute, 0);

                const timeDifferenceMinutes = Math.ceil((trainDateTime.getTime() - now.getTime()) / (1000 * 60));

                let nextStation = '';
                let nextStationKeyForStopNextStation = '普通'; 
                if (trainTypeForInfo.includes('特急')) {
                    nextStationKeyForStopNextStation = '特急';
                } else if (trainTypeForInfo.includes('快速')) {
                    nextStationKeyForStopNextStation = '快速';
                } else if (trainTypeForInfo.includes('普通')) {
                    nextStationKeyForStopNextStation = '普通';
                }

                if (data.stopnextstion && data.stopnextstion[nextStationKeyForStopNextStation] && data.stopnextstion[nextStationKeyForStopNextStation].length > 0) {
                    nextStation = data.stopnextstion[nextStationKeyForStopNextStation][0]; 
                } else {
                    nextStation = '不明'; 
                }

                if (timeDifferenceMinutes >= 0 && timeDifferenceMinutes <= 0) {
                    infoScrollingText.textContent = `この電車は ${trainTypeForInfo} ${trainDestinationForInfo} 行きです。次は${nextStation}です。発車まで今しばらくお待ちください。`;
                    scrollingAreaElement.style.setProperty('display', 'block', 'important'); 
                    infoScrollingText.style.animationPlayState = 'running'; 

                } else {
                    infoScrollingText.textContent = ''; 
                    scrollingAreaElement.style.setProperty('display', 'none', 'important'); 
                    infoScrollingText.style.animationPlayState = 'paused'; 
                }
            }

        } else {
            // 列車情報がない場合
            mainDisplayArea.innerHTML = `<div class="train-row no-trains"><span>現在、この曜日の時刻表データはありません。</span></div>`;
            if (scrollingAreaElement && infoScrollingText) {
                infoScrollingText.textContent = ''; 
                scrollingAreaElement.style.setProperty('display', 'none', 'important');
                infoScrollingText.style.animationPlayState = 'paused'; 
            }
        }

    } catch (error) {
        console.error('時刻表データの読み込みまたは表示中にエラーが発生しました:', error);
        if (mainDisplayArea) mainDisplayArea.innerHTML = '<span>データの読み込みに失敗しました。コンソールを確認してください。</span>';
        if (stopStationsDisplayArea) stopStationsDisplayArea.innerHTML = '<span>エラーが発生しました。</span>';
        
        if (scrollingAreaElement && infoScrollingText) {
            infoScrollingText.textContent = '';
            scrollingAreaElement.style.setProperty('display', 'none', 'important');
            infoScrollingText.style.animationPlayState = 'paused'; 
        }
        // エラー時にもメイン表示のインターバルをクリア
        if (displayIntervalId) {
            clearInterval(displayIntervalId);
            displayIntervalId = null;
        }
    }
}


// ページが完全に読み込まれたら時刻表表示関数を実行
document.addEventListener('DOMContentLoaded', loadAndDisplayTimetable);

// 定期的に表示を更新したい場合（メインの列車情報と緑のスクロールテキストのみが更新される）
// 停車駅の表示はDOMContentLoaded時に一度だけ設定され、以降は自動更新されません。
// ここは「列車の切り替わり」に対応するため、30秒に一度更新に留めます。
// メイン表示の言語切り替えは独立したsetIntervalで行います。
setInterval(loadAndDisplayTimetable, 20 * 1000); // 20秒ごとに更新
