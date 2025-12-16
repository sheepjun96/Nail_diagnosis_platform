let currentStlSeq = null;
let currentSrlSeq = null;

// DOM이 로드된 후에 이벤트 바인딩
document.addEventListener('DOMContentLoaded', function () {
    // 'btn_open_viewer' 버튼 클릭 이벤트
    document.getElementById('btn_open_viewer').addEventListener('click', function () {
        if (!currentStlSeq || !currentSrlSeq) {
            alert('Please select the patient and series first.');
            return;
        }
        const url = `/app/viewer?stl_seq=${encodeURIComponent(currentStlSeq)}&srl_seq=${encodeURIComponent(currentSrlSeq)}`;
        window.location.href = url;
    });

    // tbody 클릭 이벤트
    document.getElementById('main_resource_list').addEventListener('click', async function (e) {
        const tr = e.target.closest('tr');
        if (!tr) return;
        const patientId = tr.dataset.patientId;
        const stlSeq = tr.dataset.stlSeq;
        if (!patientId || !stlSeq) return;
        currentStlSeq = stlSeq;
        await loadSeriesList(patientId);
        tr.dataset.patientId = row.stl_patient_id;
        tr.dataset.stlSeq = row.stl_seq;
    });

    // 페이지 로드 시 study list 로딩
    loadStudyList();
});

// study list 로딩 함수
async function loadStudyList() {
    try {
        const res = await fetch('/api/resource/study/list', {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });
        if (!res.ok) {
            console.error('API error', res.status, res.statusText);
            return;
        }
        const data = await res.json();
        if (data.code !== 200) {
            console.error('API error', data);
            return;
        }
        const tbody = document.getElementById('main_resource_list');
        if (!tbody) {
            console.error('tbody#main_resource_list not found');
            return;
        }

        tbody.innerHTML = '';
        const items = data.context || data.items || [];

        items.forEach((row, index) => {
            const tr = document.createElement('tr');
            tr.dataset.patientId = row.stl_patient_id;
            tr.dataset.stlSeq = row.stl_seq;

            const birth = row.stl_patient_birthdate 
                ? row.stl_patient_birthdate.substring(0, 10) 
                : '';
            const studyDate = row.stl_patient_studydate 
                ? row.stl_patient_studydate.replace('T', ' ').substring(0, 19) 
                : '';
            const recentDate = row.stl_patient_recentdate 
                ? row.stl_patient_recentdate.replace('T', ' ').substring(0, 19) 
                : '';
            tr.innerHTML = `
                <td>${index + 1}</td>
                <td>${row.stl_patient_status ?? ''}</td>
                <td>${row.stl_patient_id ?? ''}</td>
                <td>${row.stl_patient_name ?? ''}</td>
                <td>${row.stl_patient_gender ?? ''}</td>
                <td>${birth}</td>
                <td>${studyDate}</td>
                <td>${recentDate}</td>
                <td>${row.stl_patient_tag ?? ''}</td>
            `;
            tbody.appendChild(tr);
        });
        attachStudyRowClickHandler();
    } catch (err) {
        console.error('study list error', err);
    }
}

// study row 클릭 이벤트 바인딩
function attachStudyRowClickHandler() {
    const tbody = document.getElementById('main_resource_list');
    if (!tbody) return;
    if (!tbody.rowClickBound) {
        tbody.rowClickBound = true;
        tbody.addEventListener('click', async function (e) {
            const tr = e.target.closest('tr');
            if (!tr) return;
            
            currentStlSeq = tr.dataset.stlSeq;
            currentSrlSeq = null;
            const patientId = tr.dataset.patientId;
            const stlSeq = tr.dataset.stlSeq;
            if (!patientId || !stlSeq) return;

            currentStlSeq = stlSeq;

            Array.from(tbody.querySelectorAll('tr')).forEach(row => {
                row.classList.remove('selected-row');
            });
            tr.classList.add('selected-row');
            await loadSeriesList(patientId);
        });
    }
}

// series list 로딩 함수
async function loadSeriesList(patientId) {
    try {
        const res = await fetch(`/api/resource/series/list?patient_id=${encodeURIComponent(patientId)}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });
        if (!res.ok) {
            console.error('Series API error', res.status, res.statusText);
            return;
        }
        const data = await res.json();
        if (data.code !== 200) {
            console.error('Series API error', data);
            return;
        }
        const seriesTbody = document.getElementById('series_list_body');
        if (!seriesTbody) {
            console.error('tbody#series_list_body not found');
            return;
        }
        seriesTbody.innerHTML = '';

        const items = data.context || [];
        items.forEach(row => {
            const tr = document.createElement('tr');
            tr.dataset.srlSeq = row.srl_seq;
            tr.dataset.seriesDt = row.date;
            const dateStr = row.date 
                ? row.date.replace('T', ' ').substring(0, 10) 
                : '';
            tr.innerHTML = `
                <td>${row.no}</td>
                <td>${dateStr}</td>
                <td>${row.instance}</td>
            `;
            seriesTbody.appendChild(tr);
        });
        attachSeriesRowClickHandler();
    } catch (err) {
        console.error('series list error', err);
    }
}

// series row 클릭 이벤트 바인딩
function attachSeriesRowClickHandler() {
    const seriesTbody = document.getElementById('series_list_body');
    if (!seriesTbody) return;
    if (!seriesTbody.rowClickBound) {
        seriesTbody.rowClickBound = true;
        seriesTbody.addEventListener('click', async function (e) {
            const tr = e.target.closest('tr');
            if (!tr) return;
            if (!currentStlSeq) {
                console.warn('stlseq not set');
                return;
            }
            const srlSeq = tr.dataset.srlSeq;
            if (!srlSeq) {
                console.warn('srl_seq not set');
                return;
            }
            Array.from(seriesTbody.querySelectorAll('tr')).forEach(row => {
                row.classList.remove('selected-row');
            });
            tr.classList.add('selected-row');
            currentSrlSeq = srlSeq || null;
            await loadPreview(currentStlSeq, srlSeq);
        });
    }
}

// preview 로딩 함수
async function loadPreview(stlSeq, srlSeq) {
    try {
        const res = await fetch(`/api/resource/series/detail?stl_seq=${encodeURIComponent(stlSeq)}&srl_seq=${encodeURIComponent(srlSeq)}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });
        if (!res.ok) {
            console.error('series/detail HTTP error', res.status);
            return;
        }
        const data = await res.json();
        if (data.code !== 200 || !data.context) {
            console.error('seriesdetail API error', data);
            return;
        }
        const row = data.context;
        const fingers = [
            { imgId: "img_l_thumb",  extraId: "extra_l_thumb",  key: "srl_patient_l_t" },
            { imgId: "img_l_index",  extraId: "extra_l_index",  key: "srl_patient_l_i" },
            { imgId: "img_l_middle", extraId: "extra_l_middle", key: "srl_patient_l_m" },
            { imgId: "img_l_ring",   extraId: "extra_l_ring",   key: "srl_patient_l_R" },
            { imgId: "img_l_pinky",  extraId: "extra_l_pinky",  key: "srl_patient_l_p" },
            { imgId: "img_r_thumb",  extraId: "extra_r_thumb",  key: "srl_patient_r_t" },
            { imgId: "img_r_index",  extraId: "extra_r_index",  key: "srl_patient_r_i" },
            { imgId: "img_r_middle", extraId: "extra_r_middle", key: "srl_patient_r_m" },
            { imgId: "img_r_ring",   extraId: "extra_r_ring",   key: "srl_patient_r_R" },
            { imgId: "img_r_pinky",  extraId: "extra_r_pinky",  key: "srl_patient_r_p" },
        ];
        fingers.forEach(f => {
            setFingerImage(
                document.getElementById(f.imgId), 
                document.getElementById(f.extraId), 
                row[f.key]);
        });
    } catch (err) {
        console.error('preview error', err);
    }
}