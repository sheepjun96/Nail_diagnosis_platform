let currentStlSeq = null;
let currentSrlSeq = null;

function updateSeriesAndPreviewOverlays() {
    const seriesOverlay  = document.getElementById("series_overlay");
    const previewOverlay = document.getElementById("preview_overlay");
    const seriesWrapper  = document.querySelector(".series-list-scroll");
    const previewWrapper = document.getElementById("preview-table-wrapper");
    if (!seriesOverlay || !previewOverlay) return;

    if (!currentStlSeq) {
        seriesOverlay.style.display  = "flex";
        previewOverlay.style.display = "flex";
        if (seriesWrapper)  seriesWrapper.style.overflowX = "hidden";
        if (previewWrapper) previewWrapper.style.overflowX = "hidden";

    } else if (!currentSrlSeq) {
        seriesOverlay.style.display  = "none";
        previewOverlay.style.display = "flex";
        if (seriesWrapper)  seriesWrapper.style.overflowX = "hidden";
        if (previewWrapper) previewWrapper.style.overflowX = "hidden";

    } else {
        seriesOverlay.style.display  = "none";
        previewOverlay.style.display = "none";
        if (seriesWrapper)  seriesWrapper.style.overflowX = "hidden";
        if (previewWrapper) previewWrapper.style.overflowX = "auto";
    }
}

// study list 로딩 함수
async function loadStudyList(page = 1) {
    try {
        const searchInput = document.getElementById("main_search_input");
        const searchText = searchInput ? searchInput.value.trim() : "";
        const params = new URLSearchParams({
            page: page.toString(),
            rows: "10"
        });

        if (searchText) {
            params.append("search", searchText);
        }

        const res = await fetch(`/api/resource/study/list?${params.toString()}`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
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
    if (!tbody || tbody._rowClickBound) return;
    tbody._rowClickBound = true;

    tbody.addEventListener('click', async function (e) {
        const tr = e.target.closest('tr');
        if (!tr) return;

        const patientId = tr.dataset.patientId;
        const stlSeq    = tr.dataset.stlSeq;
        if (!patientId || !stlSeq) return;

        currentStlSeq = stlSeq;
        currentSrlSeq = null; 

        Array.from(tbody.querySelectorAll('tr')).forEach(row =>
            row.classList.remove('selected-row')
        );
        tr.classList.add('selected-row');

        resetPreview();
        updateSeriesAndPreviewOverlays();

        await loadSeriesList(patientId);
    });
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
            const dateStr = row.date ? row.date.replace('T', ' ').substring(0, 10) : '';

            tr.innerHTML = `
                <td>${row.no}</td>
                <td>${dateStr}</td>
                <td class="diagnosis-col" title="${row.diagnosis_result}">${row.diagnosis_result}</td>
                <td>${row.instance}</td>
                <td style="padding: 0 !important; vertical-align: middle;">
                    <button type="button" class="btn-del-series-icon"
                        style="width: 20px; height: 20px; border: none; background: url('/static/imgs/trash.png') no-repeat center; background-size: contain; background-color: transparent; cursor: pointer;">
                    </button>
                </td>
            `;
            const delBtn = tr.querySelector('.btn-del-series-icon');
            if (delBtn) {
                delBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    onDeleteSeries(e, row.srl_seq, currentStlSeq);
                });
            }
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
    if (!seriesTbody || seriesTbody._rowClickBound) return;
    seriesTbody._rowClickBound = true;

    seriesTbody.addEventListener('click', async function (e) {
        const tr = e.target.closest('tr');
        if (!tr) return;
        if (!currentStlSeq) return;

        const srlSeq = tr.dataset.srlSeq;
        if (!srlSeq) return;

        currentSrlSeq = srlSeq;

        Array.from(seriesTbody.querySelectorAll('tr')).forEach(row =>
            row.classList.remove('selected-row')
        );
        tr.classList.add('selected-row');

        await loadPreview(currentStlSeq, currentSrlSeq);
        updateSeriesAndPreviewOverlays();
    });
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

async function onDeleteSeries(event, srlSeq, stlSeq) { 
    if (!confirm("Are you sure you want to delete this series?")) return;

    try {
        const response = await fetch('/api/resource/series/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ srl_seq: srlSeq, stl_seq: stlSeq })
        });
        const result = await response.json();

        if (result.ok) {
            alert("Series deleted successfully.");
            currentSrlSeq = null;
            resetPreview();
            updateSeriesAndPreviewOverlays();
            const selectedStudyRow = document.querySelector('#main_resource_list tr.selected-row');
            if (selectedStudyRow) {
                const patientId = selectedStudyRow.dataset.patientId;
                await loadSeriesList(patientId);
            }
        } else {
            alert("Delete failed: " + (result.msg || "Unknown error"));
        }
    } catch (e) {
        console.error(e);
        alert("Server communication error.");
    }
}

async function onDeleteEmptyPatient() {
    if (!currentStlSeq) {
        alert("Please select a patient first.");
        return;
    }

    if (!confirm("Do you want to delete this patient series?\n(Only possible if there are no series remaining)")) return;

    try {
        const response = await fetch('/api/resource/patient/delete_empty', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stl_seq: currentStlSeq })
        });
        const result = await response.json();

        if (result.ok) {
            alert("Patient record deleted.");
            location.reload();
        } else {
            alert("Delete failed: " + result.msg);
        }
    } catch (e) {
        console.error(e);
        alert("Server communication error.");
    }
}

function resetPreview() {
    const fingers = [
        { imgId: "img_l_thumb",  extraId: "extra_l_thumb" },
        { imgId: "img_l_index",  extraId: "extra_l_index" },
        { imgId: "img_l_middle", extraId: "extra_l_middle" },
        { imgId: "img_l_ring",   extraId: "extra_l_ring" },
        { imgId: "img_l_pinky",  extraId: "extra_l_pinky" },
        { imgId: "img_r_thumb",  extraId: "extra_r_thumb" },
        { imgId: "img_r_index",  extraId: "extra_r_index" },
        { imgId: "img_r_middle", extraId: "extra_r_middle" },
        { imgId: "img_r_ring",   extraId: "extra_r_ring" },
        { imgId: "img_r_pinky",  extraId: "extra_r_pinky" },
    ];
    fingers.forEach(f => {
        const img = document.getElementById(f.imgId);
        const extra = document.getElementById(f.extraId);
        if (img) img.src = NULL_IMG;
        if (extra) extra.textContent = "No extra";
    });
}

// DOM이 로드된 후에 이벤트 바인딩
document.addEventListener('DOMContentLoaded', function () {
    currentStlSeq = null;
    currentSrlSeq = null;
    resetPreview();
    updateSeriesAndPreviewOverlays();
    initGlobalSearch(loadStudyList);    
    
    // 'btn_open_viewer' 버튼 클릭 이벤트
    document.getElementById('btn_open_viewer').addEventListener('click', function () {
        if (!currentStlSeq || !currentSrlSeq) {
            alert('Please select the patient and series first.');
            return;
        }
        const url = `/app/viewer?stl_seq=${encodeURIComponent(currentStlSeq)}&srl_seq=${encodeURIComponent(currentSrlSeq)}`;
        window.location.href = url;
    });

    attachStudyRowClickHandler();
    attachSeriesRowClickHandler();
    loadStudyList();
});