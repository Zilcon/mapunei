document.addEventListener('DOMContentLoaded', () => {
    // --- 設定 ---
    const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxKNs2HV7zO2RFWUJxQhG_zfkO7TSMfzriT0G0seDsMVboy-AG5l7W-rqfE9KHu33k/exec';
    
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
    async function fetchData() { /* ... 変更なし ... */ }
    
    // ★データ送信関数を更新
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
                await fetchData(); // 成功したらデータを再取得
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('処理に失敗しました:', error);
            alert('処理に失敗しました。');
        }
    }

    // --- 描画関連 ---
    function renderMap() { /* ... 変更なし ... */ }
    
    // --- UI制御とヘルパー関数 ---
    function populateLoginDropdown() { /* ... 変更なし ... */ }
    function updateEditPanelVisibility() { /* ... 変更なし ... */ }

    // ★情報表示欄を更新する関数
    function updateInfoBox(stateData) {
        const infoFields = ['country', 'dev', 'data1', 'data2', 'data3', 'data4', 'data5', 'data6', 'data7'];
        const dataKeys = ['国', '開発度', 'データ1', 'データ2', 'データ3', 'データ4', 'データ5', 'データ6', 'データ7'];
        
        document.getElementById('info-id').textContent = selectedPathId || 'N/A';
        if (stateData) {
            infoFields.forEach((field, index) => {
                const key = dataKeys[index];
                document.getElementById(`info-${field}`).textContent = stateData[key] || '未設定';
            });
        } else {
            infoFields.forEach(field => {
                document.getElementById(`info-${field}`).textContent = 'データなし';
            });
        }
    }

    // --- イベントハンドラ ---
    function handleLogin() { /* ... 変更なし ... */ }

    // ★マウスクリック処理を全面的に修正
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
                path.style.stroke = ''; // ハイライト解除
            } else {
                // 選択
                nationBuildingSelection.push(selectedPathId);
                path.style.stroke = '#FF0000'; // 赤色でハイライト
                path.style.strokeWidth = '2';
            }
            return; // 建国モード中はこれ以降の処理をしない
        }

        // --- 通常モードの処理 ---
        updateInfoBox(stateData); // ★まず情報を表示
        saveButton.style.display = 'none'; // いったんボタンを隠す
        editPanel.querySelectorAll('input').forEach(input => input.disabled = true);

        const isMyLand = loggedInCountry && stateData && stateData['国'] === loggedInCountry;
        if (isMyLand) {
            // ログイン中の自国領なら編集UIを表示
            saveButton.style.display = 'block';
            editPanel.querySelectorAll('input').forEach(input => {
                input.disabled = false;
                const viewType = input.closest('.edit-field').dataset.view;
                input.value = stateData[viewType] || '';
            });
        }
    }

    // ★保存ボタンの処理
    async function handleSave() {
        if (!loggedInCountry || !selectedPathId) return;
        const currentInput = document.querySelector(`.edit-field[data-view="${currentView}"] input`);
        if (!currentInput) return;
        
        const updatedRecord = { pathID: selectedPathId };
        updatedRecord[currentView] = currentInput.value;
        
        await postData('updateData', [updatedRecord]); // actionを指定して送信
    }

    // ★建国開始ボタンの処理
    function startNationBuilding() {
        isNationBuildingMode = true;
        nationBuildingSelection = [];
        nationBuildingControls.style.display = 'block';
        startNationBuildingBtn.style.display = 'none';
        alert('建国モードを開始します。領土にする空き地を選択してください。');
    }

    // ★建国キャンセル処理
    function cancelNationBuilding() {
        isNationBuildingMode = false;
        nationBuildingControls.style.display = 'none';
        startNationBuildingBtn.style.display = 'block';
        // ハイライトを全て解除
        allPaths.forEach(p => { p.style.stroke = ''; });
        nationBuildingSelection = [];
        newNationNameInput.value = '';
    }

    // ★領土決定ボタンの処理
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
        cancelNationBuilding(); // 処理後にモードを終了
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
        updateEditPanelVisibility();
    });
    
    updateEditPanelVisibility();
    fetchData();
});
