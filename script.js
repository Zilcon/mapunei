document.addEventListener('DOMContentLoaded', () => {
    // --- 設定 ---
    const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbx9aNJJBjKYiUEugf64_BuLXdOpYMmbU1tT_u3PTc5Z-fseGcx7oMpPmTGrD9cmOFJNZQ/exec';
    
    // --- DOM要素の取得 ---
    const mapSVG = document.getElementById('interactive-map');
    const allPaths = mapSVG.querySelectorAll('path');
    const viewSelect = document.getElementById('view-select');
    const saveButton = document.getElementById('save-button');
    const infoBox = {
        id: document.getElementById('info-id'),
        country: document.getElementById('info-country'),
        dev: document.getElementById('info-dev')
    };
    const editInputs = {
        country: document.getElementById('edit-country'),
        dev: document.getElementById('edit-dev')
    };

    // --- アプリケーションの状態管理 ---
    let mapData = []; // スプレッドシートからの全データ
    let currentView = '国'; // 現在の表示モード
    let selectedPathId = null; // 現在選択されているステートのID
    let isPanning = false; // ドラッグ中かどうかのフラグ

    // --- 地図のパン・ズーム設定 ---
    const panZoomInstance = svgPanZoom('#interactive-map', {
        zoomEnabled: true,
        controlIconsEnabled: false,
        fit: true,
        center: true,
        minZoom: 0.5,
        maxZoom: 10,
        onPan: () => { isPanning = true; },
        onZoom: () => { isPanning = true; },
        // onUpdatedCTM: () => { isPanning = false; } // これを使うとクリック判定が難しくなる場合がある
    });

    // マウス/タッチの終了時にドラッグ状態をリセット
    mapSVG.addEventListener('mouseup', () => { setTimeout(() => { isPanning = false; }, 50); });
    mapSVG.addEventListener('touchend', () => { setTimeout(() => { isPanning = false; }, 50); });


    // --- データ取得・通信 ---

    /**
     * GASから地図データを非同期で取得する
     */
// script.js

/**
 * GASから地図データを非同期で取得する (JSONP版)
 */
async function fetchData() {
    // データを取得中であることを示すためにローディング表示などをここに書くこともできる

    // JSONPのためのコールバック関数を動的に作成
    const callbackName = 'jsonp_callback_' + Date.now();
    window[callbackName] = function(data) {
        // 成功したら後処理
        delete window[callbackName]; // 不要になった関数を削除
        document.body.removeChild(script); // 不要になったscriptタグを削除
        
        // グローバル変数にデータを格納
        mapData = data;
        renderMap(); // 地図を描画
        console.log('データの取得に成功しました。', mapData);
    };

    // scriptタグを動的に作成してGASにリクエストを送信
    const script = document.createElement('script');
    script.src = GAS_WEB_APP_URL + '?callback=' + callbackName; // URLの末尾に?callback=関数名 を追加
    
    // タイムアウト・エラー処理
    script.onerror = () => {
        delete window[callbackName];
        document.body.removeChild(script);
        console.error('データの取得に失敗しました: JSONPリクエストが失敗しました。');
        alert('データの取得に失敗しました。URLやデプロイ設定を確認してください。');
    };

    document.body.appendChild(script);
}

    /**
     * データをGASに送信してスプレッドシートを更新する
     * @param {Array} dataToUpdate - 更新するデータの配列
     */
    async function updateData(dataToUpdate) {
        try {
            const response = await fetch(GAS_WEB_APP_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // GASの仕様上、text/plainで送る
                body: JSON.stringify(dataToUpdate)
            });
            const result = await response.json();
            if (result.status === 'success') {
                alert(result.message);
                await fetchData(); // 成功したらデータを再取得して表示を更新
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('データの更新に失敗しました:', error);
            alert('データの更新に失敗しました。');
        }
    }

    // --- 描画関連 ---

    /**
     * 地図を現在の表示モードに応じて色分け描画する
     */
    function renderMap() {
        // 色を計算するロジック
        const getColor = (stateData) => {
            if (!stateData) return '#ccc'; // データがない場合はデフォルト色

            switch (currentView) {
                case '国':
                    // 国ごとに固定の色を割り当てる（簡易的なハッシュ）
                    if (!stateData['国']) return '#ccc';
                    const countryColors = {'日本': '#e74c3c', 'アメリカ': '#3498db', 'イギリス': '#2ecc71'};
                    return countryColors[stateData['国']] || stringToColor(stateData['国']);
                
                case '開発度':
                    // 開発度に応じて色をグラデーションさせる
                    const dev = parseInt(stateData['開発度'], 10) || 0;
                    if (dev === 0) return '#ccc';
                    const green = Math.min(200, Math.floor(dev * 2));
                    return `rgb(255, ${255 - green}, ${255 - green})`;
                
                default:
                    return '#ccc';
            }
        };

        allPaths.forEach(path => {
            const stateData = mapData.find(d => d.pathID === path.id);
            path.style.fill = getColor(stateData);
        });
    }
    
    // --- イベントハンドラ ---

    /**
     * ステートがクリック（タップ）されたときの処理
     * @param {Event} e - イベントオブジェクト
     */
    function handleStateClick(e) {
        if (isPanning) return; // ドラッグ中は処理しない

        const path = e.target;
        selectedPathId = path.id;
        const stateData = mapData.find(d => d.pathID === selectedPathId);

        // 情報ボックスを更新
        if (stateData) {
            infoBox.id.textContent = stateData.pathID;
            infoBox.country.textContent = stateData['国'] || '未設定';
            infoBox.dev.textContent = stateData['開発度'] || '0';
            
            // 編集パネルに現在の値を設定
            editInputs.country.value = stateData['国'] || '';
            editInputs.dev.value = stateData['開発度'] || '';
        } else {
            // データがない場合
            infoBox.id.textContent = selectedPathId;
            infoBox.country.textContent = 'データなし';
            infoBox.dev.textContent = 'データなし';
            editInputs.country.value = '';
            editInputs.dev.value = '';
        }
    }

    /**
     * 保存ボタンが押されたときの処理
     */
    function handleSave() {
        if (!selectedPathId) {
            alert('まず地図上のステートを選択してください。');
            return;
        }

        const updatedRecord = {
            pathID: selectedPathId,
            '国': editInputs.country.value,
            '開発度': parseInt(editInputs.dev.value, 10) || 0
            // 他のデータも同様に取得
        };

        // GASに送信するデータ形式に合わせる
        updateData([updatedRecord]);
    }

    // --- 初期化処理 ---

    // 各pathにクリックイベントリスナーを設定
    allPaths.forEach(path => {
        path.addEventListener('click', handleStateClick);
    });

    // 表示切替セレクトボックスのイベント
    viewSelect.addEventListener('change', (e) => {
        currentView = e.target.value;
        renderMap();
    });
    
    // 保存ボタンのイベント
    saveButton.addEventListener('click', handleSave);

    // 初回データ取得を実行
    fetchData();
});


// --- ヘルパー関数 ---

/**
 * 文字列から一意な色を生成する簡易的な関数
 * @param {string} str - 入力文字列（国名など）
 * @returns {string} - カラーコード
 */
function stringToColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    let color = '#';
    for (let i = 0; i < 3; i++) {
        let value = (hash >> (i * 8)) & 0xFF;
        color += ('00' + value.toString(16)).substr(-2);
    }
    return color;
}
