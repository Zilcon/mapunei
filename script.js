document.addEventListener('DOMContentLoaded', () => {
    // --- 設定 ---
    const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxJZzQ2GisgwUI3hsgFO0VR7C7FjHlCNon22K82rEvDCHiFPGtmDeLW5RByaspWKvdk/exec';
    
    // --- DOM要素の取得 ---
    const mapSVG = document.getElementById('interactive-map');
    const allPaths = mapSVG.querySelectorAll('path');
    const viewSelect = document.getElementById('view-select');
    const loginSelect = document.getElementById('country-login-select');
    const infoBox = document.getElementById('info-box');
    const editPanel = document.getElementById('edit-panel');
    const saveButton = document.getElementById('save-button');
    // ズームボタン
    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    const resetZoomBtn = document.getElementById('reset-zoom-btn');
    
    // --- アプリケーションの状態管理 ---
    let mapData = [], countryList = [], mapDataHeader = [];
    let loggedInCountry = null, selectedPathId = null;
    let currentView = '', isPanning = false;
    let isNationBuildingMode = false, nationBuildingSelection = [];

    // --- 地図のパン・ズーム設定 (モバイル対応強化) ---
    const panZoomInstance = svgPanZoom('#interactive-map', {
        zoomEnabled: true,
        controlIconsEnabled: false,
        fit: true,
        center: true,
        minZoom: 0.5,
        maxZoom: 10,
        // タップとドラッグの誤認を減らす
        beforePan: (oldPan, newPan) => {
            if (isPanning) { return newPan; }
            return false;
        }
    });
    // マウス/タッチ操作でパン状態を管理
    mapSVG.addEventListener('mousedown', () => { isPanning = true; });
    mapSVG.addEventListener('touchstart', () => { isPanning = true; });
    mapSVG.addEventListener('mouseup', () => { setTimeout(() => { isPanning = false; }, 50); });
    mapSVG.addEventListener('touchend', () => { setTimeout(() => { isPanning = false; }, 50); });
    
    // ズームボタンのイベント
    zoomInBtn.addEventListener('click', () => panZoomInstance.zoomIn());
    zoomOutBtn.addEventListener('click', () => panZoomInstance.zoomOut());
    resetZoomBtn.addEventListener('click', () => panZoomInstance.resetZoom());


    // --- データ取得・通信 ---
    async function fetchData() {
        const callbackName = 'jsonp_callback_' + Date.now();
        window[callbackName] = function(data) {
            delete window[callbackName];
            const scriptTag = document.getElementById(callbackName);
            if (scriptTag) { scriptTag.parentNode.removeChild(scriptTag); }
            
            mapData = data.mapData;
            countryList = data.countries;
            mapDataHeader = data.mapDataHeader; // ★ヘッダー情報を取得
            
            // ★取得したヘッダーを基にUIを動的に構築
            setupDynamicUI();
            
            renderMap();
            populateLoginDropdown();
            console.log('データの取得に成功しました。');
        };
        const script = document.createElement('script');
        script.id = callbackName;
        script.src = GAS_WEB_APP_URL + '?callback=' + callbackName;
        document.body.appendChild(script);
    }
    
    async function postData(action, payload) {
        try {
            const response = await fetch(GAS_WEB_APP_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action, payload }) // actionとpayloadを送信
            });
            const result = await response.json();
            if (result.status === 'success') {
                alert(result.message);
                await fetchData(); // 成功したらデータを再取得して表示を更新
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('処理に失敗しました:', error);
            alert('処理に失敗しました。');
        }
    }

    // --- ★UI動的構築 ---
    function setupDynamicUI() {
        // 表示切替ドロップダウンを生成
        viewSelect.innerHTML = '';
        mapDataHeader.forEach(header => {
            if (header === 'pathID') return; // pathIDは表示しない
            const option = document.createElement('option');
            option.value = header;
            option.textContent = header;
            viewSelect.appendChild(option);
        });
        currentView = viewSelect.value; // 初期ビューを設定

        // 情報表示欄を生成
        infoBox.innerHTML = '<h3>情報</h3>'; // タイトルをリセット
        mapDataHeader.forEach(header => {
            const p = document.createElement('p');
            p.innerHTML = `<strong>${header}:</strong> <span id="info-${header}">N/A</span>`;
            infoBox.appendChild(p);
        });

        // 編集パネルを生成
        editPanel.innerHTML = '<h3>データ編集</h3>'; // タイトルをリセット
        mapDataHeader.forEach(header => {
            if (header === 'pathID') return;
            const isCountryField = header === '国'; // 「国」フィールドは特別扱い
            const fieldDiv = document.createElement('div');
            fieldDiv.className = 'edit-field';
            fieldDiv.dataset.view = header;
            fieldDiv.innerHTML = `<label>${header}:</label><input type="${isCountryField ? 'text' : 'number'}" id="edit-${header}" ${isCountryField ? 'readonly' : ''}>`;
            editPanel.appendChild(fieldDiv);
        });
        editPanel.appendChild(saveButton); // 保存ボタンを末尾に再追加
        
        updateEditPanelVisibility();
    }
    
    // --- 描画関連 ---
    function getColor(stateData) {
        if (!stateData) return '#ccc';
        
        // ★動的なビューに対応
        if (currentView === '国') {
            const countryName = stateData['国'] || '未設定';
            const countryInfo = countryList.find(c => c.CountryName === countryName);
            return countryInfo ? countryInfo.Color : '#FFFFFF';
        } else {
            // 国以外の列は数値として扱い、汎用的なグラデーションを適用
            const value = parseInt(stateData[currentView], 10) || 0;
            if (value === 0) return '#eee';
            const intensity = Math.min(200, Math.floor(value / 10)); // スケールは適宜調整
            return `rgb(${255 - intensity}, ${255}, ${255 - intensity})`; // 緑系のグラデーション
        }
    }

    function renderMap() {
        allPaths.forEach(path => {
            const stateData = mapData.find(d => d.pathID === path.id);
            path.style.fill = getColor(stateData);
        });
    }
    
    // --- UI制御とヘルパー関数 ---
    function populateLoginDropdown() {
        loginSelect.innerHTML = '<option value="">国を選択...</option>';
        if (!countryList) return;
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
        editPanel.querySelectorAll('.edit-field').forEach(field => {
            field.style.display = (field.dataset.view === currentView) ? 'block' : 'none';
        });
    }

    function updateInfoBox(stateData) {
        mapDataHeader.forEach(header => {
            const el = document.getElementById(`info-${header}`);
            if (el) {
                el.textContent = stateData ? (stateData[header] || '未設定') : 'データなし';
            }
        });
    }

    // --- イベントハンドラ ---
    function handleLogin() {
        const selected = loginSelect.value;
        if (selected) {
            loggedInCountry = selected;
            loginStatus.textContent = `${loggedInCountry} としてログイン中`;
        } else {
            loggedInCountry = null;
            loginStatus.textContent = 'ログアウト';
        }
    }

    function handleStateClick(e) {
        if (isPanning) return;

        const path = e.target;
        selectedPathId = path.id;
        const stateData = mapData.find(d => d.pathID === selectedPathId);
        
        // --- 建国モードの処理 ---
        if (isNationBuildingMode) {
            const isEmptyLand = !stateData || !stateData['国'] || stateData['国'] === '未設定';
            if (!isEmptyLand) {
                alert('この土地は既に所有されています。空き地を選択してください。');
                return;
            }

            const selectionIndex = nationBuildingSelection.indexOf(selectedPathId);
            if (selectionIndex > -1) {
                // 選択解除
                nationBuildingSelection.splice(selectionIndex, 1);
                path.style.fill = '#FFFFFF'; // ハイライト解除 (白に戻す)
            } else {
                // 選択
                nationBuildingSelection.push(selectedPathId);
                path.style.fill = '#FFD700'; // ハイライト (ゴールド)
            }
            return;
        }

        // --- 通常モードの処理 ---
        updateInfoBox(stateData);
        saveButton.style.display = 'none';
        editPanel.querySelectorAll('input').forEach(input => input.disabled = true);

        const isMyLand = loggedInCountry && stateData && stateData['国'] === loggedInCountry;
        if (isMyLand) {
            saveButton.style.display = 'block';
            editPanel.querySelectorAll('input').forEach(input => {
                input.disabled = false;
                const viewType = input.closest('.edit-field').dataset.view;
                input.value = stateData[viewType] || '';
            });
        }
    }

    async function handleSave() {
        if (!loggedInCountry || !selectedPathId) {
            alert('ログインしていないか、マスが選択されていません。');
            return;
        }
        const currentInput = document.querySelector(`.edit-field[data-view="${currentView}"] input`);
        if (!currentInput || currentInput.disabled) {
            alert('このデータは編集できません。');
            return;
        }

        const updatedRecord = {
            pathID: selectedPathId
        };
        updatedRecord[currentView] = currentInput.value;
        
        await postData('updateData', [updatedRecord]);
    }

    function startNationBuilding() {
        isNationBuildingMode = true;
        nationBuildingSelection = [];
        nationBuildingControls.style.display = 'block';
        startNationBuildingBtn.style.display = 'none';
        alert('建国モードを開始します。領土にする空き地を選択してください。');
    }

    function cancelNationBuilding() {
        isNationBuildingMode = false;
        nationBuildingControls.style.display = 'none';
        startNationBuildingBtn.style.display = 'block';
        renderMap(); // ハイライトを元に戻すために地図全体を再描画
        nationBuildingSelection = [];
        newNationNameInput.value = '';
    }

    async function handleConfirmTerritory() {
        const newName = newNationNameInput.value.trim();
        if (!newName) {
            alert('国名を入力してください。');
            return;
        }
        if (nationBuildingSelection.length === 0) {
            alert('領土を1つ以上選択してください。');
            return;
        }
        if (countryList.some(c => c.CountryName === newName)) {
            alert('その国名は既に使用されています。');
            return;
        }

        const randomColor = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
        
        const payload = {
            name: newName,
            color: randomColor,
            territory: nationBuildingSelection
        };

        await postData('createNation', payload);
        cancelNationBuilding();
    }
    
    // --- 初期化処理 ---
    allPaths.forEach(path => { path.addEventListener('click', handleStateClick); });
    loginButton.addEventListener('click', handleLogin);
    saveButton.addEventListener('click', handleSave);
    startNationBuildingBtn.addEventListener('click', startNationBuilding);
    cancelNationBuildingBtn.addEventListener('click', cancelNationBuilding);
    confirmTerritoryBtn.addEventListener('click', handleConfirmTerritory);
    
    viewSelect.addEventListener('change', (e) => {
        currentView = e.target.value;
        renderMap();
        updateEditPanelVisibility();
    });
    
    fetchData(); // 最初にデータを取得
});
