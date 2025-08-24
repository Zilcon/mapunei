document.addEventListener('DOMContentLoaded', () => {
    // --- 設定 ---
    const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzBmqBe_ZHlpDKZxlGoQImqQN2i1tDLv8XZ2yFmj9QW9OBdwwknlsh5wFcwRs08UAi-/exec';
    
    // --- DOM要素の取得 ---
    const mapSVG = document.getElementById('interactive-map');
    const allPaths = mapSVG.querySelectorAll('path');
    const viewSelect = document.getElementById('view-select');
    const loginSelect = document.getElementById('country-login-select');
    const loginButton = document.getElementById('login-button');
    const loginStatus = document.getElementById('login-status');
    const editPanel = document.getElementById('edit-panel');
    const saveButton = document.getElementById('save-button');
    // 建国関連
    const startNationBuildingBtn = document.getElementById('start-nation-building-button');
    const nationBuildingControls = document.getElementById('nation-building-controls');
    const newNationNameInput = document.getElementById('new-nation-name');
    const confirmTerritoryBtn = document.getElementById('confirm-territory-button');
    const cancelNationBuildingBtn = document.getElementById('cancel-nation-building-button');

    // --- アプリケーションの状態管理 ---
    let mapData = [], countryList = [];
    let loggedInCountry = null, selectedPathId = null;
    let currentView = '国', isPanning = false;
    let isNationBuildingMode = false; // 建国モードのフラグ
    let nationBuildingSelection = []; // 建国で選択中のマス

    // --- 地図のパン・ズーム設定 ---
    const panZoomInstance = svgPanZoom('#interactive-map', { zoomEnabled: true, controlIconsEnabled: false, fit: true, center: true, minZoom: 0.5, maxZoom: 10, onPan: () => { isPanning = true; }, onZoom: () => { isPanning = true; }});
    mapSVG.addEventListener('mouseup', () => { setTimeout(() => { isPanning = false; }, 50); });
    mapSVG.addEventListener('touchend', () => { setTimeout(() => { isPanning = false; }, 50); });

    // --- データ取得・通信 ---
    async function fetchData() {
        const callbackName = 'jsonp_callback_' + Date.now();
        window[callbackName] = function(data) {
            delete window[callbackName];
            const scriptTag = document.getElementById(callbackName);
            if (scriptTag && scriptTag.parentNode) { 
                scriptTag.parentNode.removeChild(scriptTag);
            }
            
            if (data.status === 'error') {
                alert('サーバーエラー: ' + data.message);
                return;
            }
            
            mapData = data.mapData;
            countryList = data.countries;
            
            renderMap();
            populateLoginDropdown();
            console.log('データの取得に成功しました。');
        };

        const script = document.createElement('script');
        script.id = callbackName;
        script.src = GAS_WEB_APP_URL + '?callback=' + callbackName;
        script.onerror = () => { 
            console.error('データの取得に失敗しました: JSONPリクエストが失敗しました。'); 
            alert('データの取得に失敗しました。'); 
        };
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

    // --- 描画関連 ---
    const getColor = (stateData) => {
        if (!stateData) return '#ccc';
        switch (currentView) {
            case '国':
                const countryName = stateData['国'] || '未設定';
                const countryInfo = countryList.find(c => c.CountryName === countryName);
                return countryInfo ? countryInfo.Color : '#FFFFFF'; // 未設定国は白
            case '開発度':
                const dev = parseInt(stateData['開発度'], 10) || 0;
                if (dev === 0) return '#ccc';
                const red = Math.max(0, 255 - Math.floor(dev * 2.5));
                return `rgb(255, ${red}, ${red})`;
            // 必要に応じてデータ1〜7の描画ルールを追加
            default:
                return '#ccc';
        }
    };

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
        const infoFields = ['country', 'dev', 'data1', 'data2', 'data3', 'data4', 'data5', 'data6', 'data7'];
        const dataKeys = ['国', '開発度', 'データ1', 'データ2', 'データ3', 'データ4', 'データ5', 'データ6', 'データ7'];
        
        document.getElementById('info-id').textContent = selectedPathId || 'N/A';
        if (stateData) {
            infoFields.forEach((field, index) => {
                const key = dataKeys[index];
                const element = document.getElementById(`info-${field}`);
                if(element) {
                    element.textContent = stateData[key] || '未設定';
                }
            });
        } else {
            infoFields.forEach(field => {
                const element = document.getElementById(`info-${field}`);
                if (element) {
                    element.textContent = 'データなし';
                }
            });
        }
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
    
    updateEditPanelVisibility();
    fetchData();
});
