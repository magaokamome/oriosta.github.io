// script.js の全体のコード

// JSONファイルのパス（index.htmlと同じディレクトリにjikokuhyo.jsonがある場合）
const JSON_FILE_PATH = 'jikokuhyo.json';

// HTML要素の取得（初期はnullで宣言し、DOMContentLoadedで確実に取得する）
let mainDisplayArea = null;
let stopStationsDisplayArea = null;
// カウントダウン関連の要素はHTMLから削除されたため、ここでは参照しませんし、変数も宣言しません。

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
 * 現在の時刻に基づいて、表示すべき時刻表のデータを取得する
 * JSONに現在時刻以降の列車がない場合、次の日の始発を表示する
 * @param {Object} timetableData - JSONから読み込んだ時刻表データ全体
 * @returns {Object} - フィルターされた列車、曜日タイプ、最も近い次の列車
 */
function getTrainsForCurrentTime(timetableData) {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const dayOfWeek = now.getDay(); // 0:日曜, 1:月曜, ..., 6:土曜

    let currentTimetable;
    let timetableType = ''; // 表示する曜日タイプ（平日 or 休日）

    // 休日データがJSONに存在し、今日が土日であれば休日時刻表を使用
    // 休日データがない場合は平日データを使用
    if ((dayOfWeek === 0 || dayOfWeek === 6) && timetableData.timetable.holidays && timetableData.timetable.holidays.length > 0) {
        currentTimetable = timetableData.timetable.holidays;
        timetableType = '(休日)';
    } else {
        currentTimetable = timetableData.timetable.weekdays;
        timetableType = '(平日)';
    }

    // ★★★ フィルタリングデバッグ用ログ（Consoleに表示されます） ★★★
    console.log('--- getTrainsForCurrentTime 関数デバッグ情報 ---');
    console.log('現在のシステム時刻:', currentHour, '時', currentMinute, '分');
    console.log('現在の曜日 (0=日, 1=月, ..., 6=土):', dayOfWeek);
    console.log('選択された時刻表タイプ:', timetableType);
    console.log('フィルター前の列車データ（currentTimetable）:', currentTimetable);
    console.log('フィルター前の列車数:', currentTimetable ? currentTimetable.length : 'データなし');
    // ★★★ ここまでデバッグ用ログ ★★★

    // 現在時刻以降の列車のみをフィルター
    const upcomingTrains = currentTimetable ? currentTimetable.filter(train => {
        const [trainHour, trainMinute] = train.time.split(':').map(Number);
        if (trainHour > currentHour) {
            return true;
        }
        if (trainHour === currentHour && trainMinute >= currentMinute) {
            return true;
        }
        return false;
    }) : [];

    // ★★★ フィルタリング結果デバッグ用ログ ★★★
    console.log('フィルター後のupcomingTrains:', upcomingTrains);
    console.log('フィルター後のupcomingTrains数:', upcomingTrains.length);
    // ★★★ ここまでデバッグ用ログ ★★★

    let trainsToDisplay = upcomingTrains;
    let firstUpcomingTrain = upcomingTrains.length > 0 ? upcomingTrains[0] : null;

    // もし現在時刻以降の列車がない場合
    if (upcomingTrains.length === 0) {
        // 次の日の始発を表示するロジック
        // currentTimetableの一番最初の列車を「次の日の始発」とみなす
        if (currentTimetable && currentTimetable.length > 0) {
            const nextDayFirstTrain = currentTimetable[0];
            trainsToDisplay = [nextDayFirstTrain]; // 次の日の始発のみ表示
            firstUpcomingTrain = nextDayFirstTrain;
            console.log('現在時刻以降の列車がないため、次の日の始発を表示します:', nextDayFirstTrain);
        } else {
            // 時刻表データ自体が空の場合
            trainsToDisplay = [];
            firstUpcomingTrain = null;
            console.log('時刻表データが空のため、表示する列車がありません。');
        }
    }

    // ★★★ 最終的な戻り値のデバッグ用ログ ★★★
    console.log('最終的に表示に選ばれた列車データ（trainsToDisplay）:', trainsToDisplay);
    console.log('最終的に表示に選ばれた列車数:', trainsToDisplay ? trainsToDisplay.length : 'データなし');
    console.log('最初に表示される列車（firstUpcomingTrain）:', firstUpcomingTrain);
    console.log('--- getTrainsForCurrentTime 関数デバッグ情報 終了 ---');
    // ★★★ ここまでデバッグ用ログ ★★★

    return {
        trains: trainsToDisplay,
        type: timetableType,
        firstUpcomingTrain: firstUpcomingTrain
    };
}

// ★★★ カウントダウン表示を更新する関数は完全に削除しました ★★★


/**
 * データを読み込み、電光掲示板の表示を更新する
 */
async function loadAndDisplayTimetable() {
    try {
        // HTML要素がDOMに存在することを確認してから取得
        mainDisplayArea = document.getElementById('main-display-area');
        stopStationsDisplayArea = document.getElementById('stop-stations-display-area');

        // 必須要素の存在チェック（電光掲示板関連のみ）
        if (!mainDisplayArea || !stopStationsDisplayArea) {
            console.error('必須のHTML要素（mainDisplayAreaまたはstopStationsDisplayArea）が見つかりません。HTMLファイルを確認してください。');
            // エラーが発生した場合、ここで処理を中断
            return;
        }

        // JSONファイルをフェッチ（取得）
        const response = await fetch(JSON_FILE_PATH);

        // レスポンスが正常でなければエラーを投げる
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} - ${response.url}`);
        }

        // JSONデータをJavaScriptオブジェクトに変換
        const data = await response.json();

        // ★★★ データ読み込み成功ログ ★★★
        console.log('JSONデータが正常に読み込まれました:', data);
        // ★★★ ここまでログ ★★★

        // 表示すべき列車データと曜日タイプを取得
        const { trains, type: timetableType, firstUpcomingTrain } = getTrainsForCurrentTime(data);

        // ★★★ カウントダウン関連のロジックや、お気に入り機能のロジックはすべて削除しました ★★★

        // --- メイン表示（時刻表）の生成 ---
        let mainHtmlContent = '';

        if (trains && trains.length > 0) {
            const train = trains[0];
            mainHtmlContent += `
                <div class="train-row">
                    <span class="train-type">${train.type}</span>
                    <span class="train-time">${train.time}</span>
                    <span class="train-destination">${train.destination}</span>
                    ${train.delay ? `<span class="train-delay">${train.delay}</span>` : ''}
                </div>
            `;
        } else {
            mainHtmlContent += `<div class="train-row no-trains"><span>現在、この曜日の時刻表データはありません。</span></div>`;
        }

        mainDisplayArea.innerHTML = mainHtmlContent;


        // --- 停車駅表示の生成 ---
        let stopStationsHtmlContent = '';
        let currentTrainTypeKey = null;
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
            }
        }

        const stopStations = data.stopStations ? data.stopStations[currentTrainTypeKey] : undefined;

        if (stopStations && Array.isArray(stopStations) && stopStations.length > 0) {
            stopStationsHtmlContent += `小倉までの停車駅は、${stopStations.join('、')} です。`;
        } else {
            stopStationsHtmlContent += `【${displayTrainType}】停車駅情報は登録されていません。　`;
        }
        stopStationsDisplayArea.innerHTML = `<span>${stopStationsHtmlContent}</span>`;


    } catch (error) {
        console.error('時刻表データの読み込みまたは表示中にエラーが発生しました:', error);
        // エラー発生時も要素が存在すればメッセージを表示
        if (mainDisplayArea) mainDisplayArea.innerHTML = '<span>データの読み込みに失敗しました。コンソールを確認してください。</span>';
        if (stopStationsDisplayArea) stopStationsDisplayArea.innerHTML = '<span>エラーが発生しました。</span>';
    }
}


// ページが完全に読み込まれたら時刻表表示関数を実行
document.addEventListener('DOMContentLoaded', loadAndDisplayTimetable);

// オプション: 定期的に表示を更新したい場合（例: 1分ごと）
// これを有効にすると、1分ごとに列車が更新され、次の列車が表示されるようになります
setInterval(loadAndDisplayTimetable, 60 * 1000); // 1分ごとに更新