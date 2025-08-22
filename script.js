document.addEventListener('DOMContentLoaded', () => {
    // --- 設定 ---
    const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxk5WSNnqbqUu1XdKoFQlEW3UGZQdDzZMIuN_5Sn77qSvs2eczIX2V1Of4C9B47IFuU/exec';
    
    // --- DOM要素の取得 ---
    const mapSVG = document.getElementById('interactive-map');
    const allPaths = mapSVG.querySelectorAll('path');
    const viewSelect = document.getElementById('view-select');
    const saveButton = document.getElementById('save-button');
    const loginSelect = document.getElementById('country-login-select');
    const loginButton = document.getElementById('login-button');
    const loginStatus = document.getElementById('login-status');
    const editFields = document.querySelectorAll('.edit-field');
    
    const infoBox = {
        id: document.getElementById('info-id'),
        country: document.getElementById('info-country'),
        dev: document.getElementById('info-dev')
    };

    // --- アプリケーションの状態管理 ---
    let mapData = [];
    let countryList = []; // 国リストを保存する配列
    let loggedInCountry = null; // ログイン中の国名を保存
    let currentView = '国';
    let selectedPathId = null;
    let isPanning = false;

    // --- 地図のパン・ズーム設定 (変更なし) ---
    const panZoomInstance = svgPanZoom('#interactive-map', { zoomEnabled: true, controlIconsEnabled: false, fit: true, center: true, minZoom: 0.5, maxZoom: 10, onPan: () => { isPanning = true; }, onZoom: () => { isPanning = true; }});
    mapSVG.addEventListener('mouseup', () => { setTimeout(() => { isPanning = false; }, 50); });
    mapSVG.addEventListener('touchend', () => { setTimeout(() => { isPanning = false; }, 50); });

    // --- データ取得・通信 ---

    async function fetchData() {
        const callbackName = 'jsonp_callback_' + Date.now();
        window[callbackName] = function(data) {
            delete window[callbackName];
            document.body.removeChild(script);
            
            // GASから受け取ったデータをそれぞれの配列に格納
            mapData = data.mapData;
            countryList = data.countries;
            
            renderMap();
            populateLoginDropdown(); // ログイン用ドロップダウンを生成
            console.log('データの取得に成功しました。');
        };

        const script = document.createElement('script');
        script.src = GAS_WEB_APP_URL + '?callback=' + callbackName;
        script.onerror = () => { console.error('データの取得に失敗しました: JSONPリクエストが失敗しました。'); alert('データの取得に失敗しました。'); };
        document.body.appendChild(script);
    }
    
    // updateData関数 (変更なし)
    async function updateData(dataToUpdate) { /* ... 既存のコードをそのままコピー ... */ }

    // --- 描画関連 ---

    function renderMap() {
        const getColor = (stateData) => {
            if (!stateData) return '#ccc';
            
            switch (currentView) {
                case '国':
                    const countryName = stateData['国'] || '未設定';
                    const countryInfo = countryList.find(c => c.CountryName === countryName);
                    return countryInfo ? countryInfo.Color : '#FFFFFF'; // 見つからなければ白
                
                case '開発度':
                    const dev = parseInt(stateData['開発度'], 10) || 0;
                    if (dev === 0) return '#ccc';
                    const red = Math.max(0, 255 - Math.floor(dev * 2.5));
                    return `rgb(255, ${red}, ${red})`;

                // TODO: データ1〜7の描画ロジックを追加 (例としてデータ1)
                case 'データ1':
                     const data1 = parseInt(stateData['データ1'], 10) || 0;
                     const blue = Math.min(255, Math.floor(data1 / 10)); // 例: 値に応じて青の濃さを変える
                     return `rgb(${255-blue}, ${255-blue}, 255)`;

                default:
                    return '#ccc';
            }
        };

        allPaths.forEach(path => {
            const stateData = mapData.find(d => d.pathID === path.id);
            path.style.fill = getColor(stateData);
        });
    }
    
    // --- UI制御 ---

    function populateLoginDropdown() {
        loginSelect.innerHTML = '<option value="">国を選択...</option>';
        countryList.forEach(country => {
            if (country.CountryName) {
                const option = document.createElement('option');
                option.value = country.CountryName;
                option.textContent = country.CountryName;
                loginSelect.appendChild(option);
            }
        });
    }

    function updateEditPanelVisibility() {
        editFields.forEach(field => {
            if (field.dataset.view === currentView) {
                field.style.display = 'block';
            } else {
                field.style.display = 'none';
            }
        });
    }

    // --- イベントハンドラ ---

    function handleLogin() {
        const selected = loginSelect.value;
        if (selected) {
            loggedInCountry = selected;
            loginStatus.textContent = `${loggedInCountry} としてログイン中`;
            saveButton.disabled = false; // 保存ボタンを有効化
            alert(`${loggedInCountry}としてログインしました。`);
        } else {
            loggedInCountry = null;
            loginStatus.textContent = 'ログアウト';
            saveButton.disabled = true; // 保存ボタンを無効化
            alert('ログアウトしました。');
        }
    }

    function handleStateClick(e) { /* ... 既存のコードをそのままコピー ... */ }

    function handleSave() {
        if (!loggedInCountry) {
            alert('ログインしてください。');
            return;
        }
        if (!selectedPathId) {
            alert('まず地図上のステートを選択してください。');
            return;
        }
        
        // 現在のビューに対応する入力欄から値を取得
        const currentInput = document.querySelector(`.edit-field[data-view="${currentView}"] input`);
        if (!currentInput) return;

        const updatedRecord = {
            pathID: selectedPathId
        };
        // 現在のビューのキーと値だけを更新オブジェクトに含める
        updatedRecord[currentView] = currentInput.value;

        updateData([updatedRecord]);
    }
    
    // --- 初期化処理 ---
    allPaths.forEach(path => { path.addEventListener('click', handleStateClick); });
    loginButton.addEventListener('click', handleLogin); // ログインボタンのイベントリスナー
    saveButton.addEventListener('click', handleSave);

    viewSelect.addEventListener('change', (e) => {
        currentView = e.target.value;
        renderMap();
        updateEditPanelVisibility(); // 表示切替時に編集パネルも更新
    });
    
    updateEditPanelVisibility(); // 初期表示
    fetchData();
});

// --- ヘルパー関数 (変更なし) ---
function stringToColor(str) { /* ... 既存のコードをそのままコピー ... */ }


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
