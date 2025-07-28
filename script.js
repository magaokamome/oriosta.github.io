// script.js の全体のコード

// JSONファイルのパス（index.htmlと同じディレクトリにjikokuhyo.jsonがある場合）
const JSON_FILE_PATH = 'jikokuhyo.json';

// HTML要素の取得（初期はnullで宣言し、DOMContentLoadedで確実に取得する）
let mainDisplayArea = null;
let stopStationsDisplayArea = null;

// スクロールアニメーションに干渉しないよう、不要な変数宣言を削除
let stopStationsSpanElement = null; // 停車駅表示用のspan要素への参照

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


        // ★★★ ここから停車駅表示のJavaScript更新ロジックを完全に削除します ★★★
        // 初回ロード時のみHTMLにコンテンツを書き込むようにし、
        // 以降のsetInterval呼び出しではこのブロックが実行されないようにします。
        
        // --- 停車駅表示の生成 (DOMContentLoaded時のみ実行) ---
        // (DOMContentLoadedイベントリスナー内の処理として移動することを想定)
        // もしこの関数がDOMContentLoaedからしか呼ばれないのであれば、以下のifは不要ですが、
        // setIntervalからも呼ばれるため、stopStationsSpanElementが未設定の場合のみ実行します。
        if (!stopStationsSpanElement) {
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

            // 停車駅表示エリアの最初の span 要素を取得し、設定
            stopStationsSpanElement = stopStationsDisplayArea.querySelector('span');
            if (!stopStationsSpanElement) {
                stopStationsSpanElement = document.createElement('span');
                stopStationsDisplayArea.appendChild(stopStationsSpanElement);
            }
            // 初回のみinnerHTMLを設定。以降は更新しない。
            stopStationsSpanElement.innerHTML = currentOriginalStopStationsHtml;
        }
        // ★★★ ここまで停車駅表示のJavaScript更新ロジックを完全に削除（初回のみ実行） ★★★

    } catch (error) {
        console.error('時刻表データの読み込みまたは表示中にエラーが発生しました:', error);
        if (mainDisplayArea) mainDisplayArea.innerHTML = '<span>データの読み込みに失敗しました。コンソールを確認してください。</span>';
        if (stopStationsDisplayArea) stopStationsDisplayArea.innerHTML = '<span>エラーが発生しました。</span>';
    }
}


// ページが完全に読み込まれたら時刻表表示関数を実行
document.addEventListener('DOMContentLoaded', loadAndDisplayTimetable);

// 定期的に表示を更新したい場合（メインの列車情報のみが更新される）
// 停車駅の表示はDOMContentLoaded時に一度だけ設定され、以降は自動更新されません。
setInterval(loadAndDisplayTimetable, 60 * 1000); // 60秒 (1分) ごとに更新
