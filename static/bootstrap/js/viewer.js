let originalPatient = null;
const stlSeq = getQueryParam("stl_seq");
let currentSrlSeq = getQueryParam("srl_seq");
let viewerPatientId = null;

document.addEventListener('DOMContentLoaded', function () {
    // 페이지 로드 시 호출
    loadPatientInfo().then(() => {
        loadSeriesListForViewer();
        loadPreview();
        loadPatientNote();
        loadProgression();
        loadProgressionCharts();
    });

    document.querySelector(".btn.btn-secondary.w-100").addEventListener("click", async () => {
        if (!stlSeq || !originalPatient) return;

        const curId = document.getElementById("add_patient_id").value.trim();
        const curName = document.getElementById("add_patient_name").value.trim();
        const curGender = document.getElementById("add_patient_gender").value;
        const curBirth = document.getElementById("add_patient_birth").value || null; // "YYYY-MM-DD" or ""

        const changed =
            curId !== (originalPatient.patient_id || "") ||
            curName !== (originalPatient.patient_name || "") ||
            curGender !== (originalPatient.patient_gender || "") ||
            curBirth !== (originalPatient.patient_birthdate ? originalPatient.patient_birthdate.substring(0, 10) : "");

        if (!changed) {
            alert("There are no changes.");
            return;
        }

        const formData = new FormData();
        formData.append("stl_seq", stlSeq);
        formData.append("patient_id", curId);
        formData.append("patient_name", curName);
        formData.append("patient_gender", curGender);
        if (curBirth) formData.append("patient_birth", curBirth);

        const res = await fetch("/api/resource/viewer/patient/modify", {
            method: "POST",
            body: formData,
        });
        const data = await res.json();
        if (data.code === 200) {
            alert("Patient information has been updated.");
            // 성공 후 원본 값 갱신
            originalPatient.patient_id = curId;
            originalPatient.patient_name = curName;
            originalPatient.patient_gender = curGender;
            originalPatient.patient_birthdate = curBirth;
        } else {
            alert("Modification failed: " + (data.message || "Unknown error"));
        }
    });

    document.querySelector(".btn-revise").addEventListener("click", (e) => {
        e.preventDefault();
        savePatientNote();
    });
});

// URL에서 stlseq와 srlseq를 가져오는 함수
function getQueryParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
}

async function loadPatientInfo() {
    if (!stlSeq) return;

    const res = await fetch(
        `/api/resource/viewer/info?stl_seq=${encodeURIComponent(stlSeq)}`
    );
    if (!res.ok) return;
    const data = await res.json();
    if (data.code !== 200 || !data.context) return;

    const info = data.context;

    originalPatient = {
        patientid: info.patient_id,
        patientname: info.patient_name,
        patientgender: info.patient_gender,
        patientbirthdate: info.patient_birthdate,
        patientrecentdate: info.patient_recentdate,
        type: info.type
    };
    viewerPatientId = info.patient_id;

    // Type: Exist/New
    const typeSelect = document.getElementById("add_patient_type");
    if (typeSelect) {
        typeSelect.value = info.type;  // "New" or "Exist"
    }

    // ID
    const idInput = document.getElementById("add_patient_id");
    if (idInput) {
        idInput.value = info.patient_id || "";
    }

    // Name
    const nameInput = document.getElementById("add_patient_name");
    if (nameInput) {
        nameInput.value = info.patient_name || "";
    }

    // Gender
    const genderSelect = document.getElementById("add_patient_gender");
    if (genderSelect && info.patient_gender) {
        genderSelect.value = info.patient_gender;  // "M" or "F"
    }

    // Birthday
    const birthInput = document.getElementById("add_patient_birth");
    if (birthInput) {
        birthInput.value = info.patient_birthdate
            ? info.patient_birthdate.substring(0, 10)   // "YYYY-MM-DD"
            : "";
    }

    // Recent
    const recentCell = document.getElementById("add_patient_recent");
    if (recentCell) {
        recentCell.textContent = info.patient_recentdate
            ? info.patient_recentdate.replace("T", " ").substring(0, 16)
            : "";
    }
}

async function loadSeriesListForViewer() {
    if (!viewerPatientId) return;

    const res = await fetch(
        `/api/resource/series/list?patient_id=${encodeURIComponent(viewerPatientId)}`
    );
    if (!res.ok) return;
    const data = await res.json();
    if (data.code !== 200 || !data.context) return;

    const tbody = document.getElementById("viewer_series_body");
    if (!tbody) return;

    tbody.innerHTML = "";
    const items = data.context || [];

    items.forEach(row => {
        const tr = document.createElement("tr");

        tr.dataset.srlSeq = row.srl_seq;
        tr.dataset.seriesDt = row.date;

        const dateStr = row.date
            ? String(row.date).replace("T", " ").substring(0, 10)
            : "";

        tr.innerHTML = `
            <td>${row.no}</td>
            <td>${dateStr}</td>
            <td>${row.instance}</td>
        `;

        // 초기 진입 시 URL 의 srl_seq 와 같은 행 선택
        if (String(row.srl_seq) === String(currentSrlSeq)) {
            tr.classList.add("selected-row");
        }

        tbody.appendChild(tr);
    });

    attachViewerSeriesRowClickHandler();
}

function attachViewerSeriesRowClickHandler() {
    const tbody = document.getElementById("viewer_series_body");
    if (!tbody || tbody._rowClickBound) return;
    tbody._rowClickBound = true;

    tbody.addEventListener("click", (e) => {
        const tr = e.target.closest("tr");
        if (!tr) return;

        const srlSeq = tr.dataset.srlSeq;
        if (!srlSeq) return;

        // 선택 하이라이트
        Array.from(tbody.querySelectorAll("tr")).forEach(row =>
            row.classList.remove("selected-row")
        );
        tr.classList.add("selected-row");

        // srl_seq 만 변경 리다이렉트
        const url = `/app/viewer?stl_seq=${encodeURIComponent(stlSeq)}&srl_seq=${encodeURIComponent(srlSeq)}`;
        window.location.href = url;
    });
}

async function loadPreview() {
    if (!stlSeq || !currentSrlSeq) return;

    const res = await fetch(`/api/resource/series/detail?stl_seq=${encodeURIComponent(stlSeq)}&srl_seq=${encodeURIComponent(currentSrlSeq)}`);
    const data = await res.json();
    if (data.code !== 200 || !data.context) return;

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
            row[f.key]
        );
    });
}

async function loadPatientNote() {
    if (!stlSeq || !currentSrlSeq) return;

    const res = await fetch(
        `/api/resource/viewer/series_note?stl_seq=${encodeURIComponent(stlSeq)}&srl_seq=${encodeURIComponent(currentSrlSeq)}`
    );
    const data = await res.json();
    if (data.code !== 200 || !data.context) return;

    const textarea = document.getElementById("patient_note_textarea");
    textarea.value = data.context || "";
}

async function savePatientNote() {
    const textarea = document.getElementById("patient_note_textarea");
    const note = textarea.value;

    const res = await fetch("/api/resource/viewer/update_series_note", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            stl_seq: stlSeq,
            srl_seq: currentSrlSeq,
            note: note
        })
    });
    const data = await res.json();
    if (data.code === 200) {
        alert("Note saved successfully.");
    } else {
        alert("Failed to save note.");
    }
}

async function loadProgression() {
    if (!viewerPatientId) return;

    const res = await fetch(
        `/api/resource/series/list?patient_id=${encodeURIComponent(viewerPatientId)}`
    );
    if (!res.ok) return;
    const data = await res.json();
    if (data.code !== 200 || !data.context) return;

    const listItems = data.context || [];

    const leftBody = document.getElementById("left_hand_body");
    const rightBody = document.getElementById("right_hand_body");

    if (!leftBody || !rightBody) return;

    leftBody.innerHTML = "";
    rightBody.innerHTML = "";

    leftBody.appendChild(createHeaderRow());
    rightBody.appendChild(createHeaderRow().cloneNode(true));

    // 과거 -> 현재
    // listItems.sort((a, b) => String(a.date).localeCompare(String(b.date)));

    // 현재 -> 과거
    listItems.sort((a, b) => String(b.date).localeCompare(String(a.date)));

    for (const item of listItems) {
        const dateStr = item.date ? String(item.date).substring(0, 10) : "";
        const srlSeq = item.srl_seq;

        const detailRes = await fetch(
            `/api/resource/series/detail?stl_seq=${encodeURIComponent(stlSeq)}&srl_seq=${encodeURIComponent(srlSeq)}`
        );
        if (!detailRes.ok) continue;
        const detailData = await detailRes.json();
        if (detailData.code !== 200 || !detailData.context) continue;

        const ctx = detailData.context;

        const note = ctx.srl_patient_note || "";

    buildHandBlockFromCtx(leftBody, "l", dateStr, ctx, note);
    buildHandBlockFromCtx(rightBody, "r", dateStr, ctx, note);
    }
}

function createHeaderRow() {
    const tr = document.createElement("tr");
    tr.className = "bg-bg3";
    tr.innerHTML = `
        <th>Date</th>
        <th>Thumb</th>
        <th>Index</th>
        <th>Middle</th>
        <th>Ring</th>
        <th>Pinky</th>
    `;
    return tr;
}

function buildHandBlockFromCtx(tbody, side, dateStr, ctx, note) {
    const fingerKeys =
        side === "l"
            ? ["srl_patient_l_t", "srl_patient_l_i", "srl_patient_l_m", "srl_patient_l_R", "srl_patient_l_p"]
            : ["srl_patient_r_t", "srl_patient_r_i", "srl_patient_r_m", "srl_patient_r_R", "srl_patient_r_p"];

    // 1행: 이미지 + 날짜
    const trImg = document.createElement("tr");
    const dateTd = document.createElement("td");
    dateTd.rowSpan = 4;
    dateTd.className = "p-1 fit-image";
    dateTd.style.width = "16%";

    if (dateStr) {
        const [y, m, d] = dateStr.split("-");
        dateTd.innerHTML = `<span>${y}<br/>/${parseInt(m, 10)}<br/>/${parseInt(d, 10)}</span>`;
    } else {
        dateTd.innerHTML = "<span>-</span>";
    }
    trImg.appendChild(dateTd);

    const aiValues = [];
    const extraLists = [];

    fingerKeys.forEach((col) => {
        const td = document.createElement("td");
        td.className = "p-1 fit-image";
        td.style.width = "16%";
        td.style.height = "60px";

        let cropUrl = "";
        let extraList = [];
        let aiScore = 0;

        const raw = ctx[col];
        if (raw) {
            try {
                const nailObj = JSON.parse(raw);
                cropUrl = nailObj.crop || "";
                extraList = nailObj.extra || [];
                if (nailObj.ai) {
                    const aiObj = JSON.parse(nailObj.ai);
                    aiScore = aiObj.probability
                        ? Math.round(aiObj.probability * 10000) / 100
                        : 0;
                }
            } catch (e) {
                console.error("nail parse error", col, e);
            }
        }

        td.innerHTML = cropUrl
            ? `<img src="${cropUrl}" height="60px" />`
            : `<img src="/static/imgs/Null.png" height="60px" />`;

        trImg.appendChild(td);
        aiValues.push(aiScore);
        extraLists.push(extraList);   
    });


    // 2행: AI 값
    const trAi = document.createElement("tr");
    aiValues.forEach((v) => {
        const td = document.createElement("td");
        td.className = "p-1";
        td.style.width = "16%";
        td.textContent = v || 0;
        trAi.appendChild(td);
    });

    // 3행: Extra
    const trExtra = document.createElement("tr");
    extraLists.forEach((list) => {
        const td = document.createElement("td");
        td.className = "p-1";
        td.style.width = "16%";
        td.style.height = "60px";
        if (list && list.length > 0) {
            td.innerHTML = list
                .map((url) => `<img src="${url}" height="40px" style="margin:1px;" />`)
                .join("");
        } else {
            td.textContent = "No Extra";
        }
        trExtra.appendChild(td);
    });

    // 4행: note
    const trNote = document.createElement("tr");
    const tdNote = document.createElement("td");
    tdNote.className = "p-1 text-left";
    tdNote.colSpan = 5;
    tdNote.style.width = "16%";
    tdNote.textContent = `note : ${note}`;
    trNote.appendChild(tdNote);

    tbody.appendChild(trImg);
    tbody.appendChild(trAi);
    tbody.appendChild(trExtra);
    tbody.appendChild(trNote);
}

function getAiScoreFromNailJson(raw) {
    if (!raw) return null;
    try {
        const nailObj = JSON.parse(raw);
        if (!nailObj.ai) return null;
        const aiObj = JSON.parse(nailObj.ai);
        if (!aiObj.predicted_class || aiObj.probability == null) return null;

        let p = aiObj.probability * 100; // 0~100
        // Healthy_Nail 이면 100 - p
        if (aiObj.predicted_class === "Healthy_Nail") {
            p = 100 - p;
        }
        return Math.round(p * 100) / 100; // 소수 둘째 자리
    } catch (e) {
        console.error("ai parse error", e);
        return null;
    }
}

async function buildHandAiSeries(side) {
    if (!viewerPatientId || !stlSeq) return null;

    const res = await fetch(
        `/api/resource/series/list?patient_id=${encodeURIComponent(viewerPatientId)}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.code !== 200 || !data.context) return null;

    const listItems = data.context || [];
    // 날짜 오름차순 정렬
    listItems.sort((a, b) => String(a.date).localeCompare(String(b.date)));

    const labels = [];
    const thumb = [], indexF = [], middle = [], ring = [], pinky = [];

    for (const item of listItems) {
        const dateStr = item.date ? String(item.date).substring(0, 10) : "";
        const srlSeq = item.srl_seq;

        const detailRes = await fetch(
            `/api/resource/series/detail?stl_seq=${encodeURIComponent(stlSeq)}&srl_seq=${encodeURIComponent(srlSeq)}`
        );
        if (!detailRes.ok) continue;
        const detailData = await detailRes.json();
        if (detailData.code !== 200 || !detailData.context) continue;
        const ctx = detailData.context;

        const prefix = side === "l" ? "srl_patient_l_" : "srl_patient_r_";
        const cols = [
            prefix + "t",
            prefix + "i",
            prefix + "m",
            prefix + "R",
            prefix + "p"
        ];

        const tmp = cols.map(col => getAiScoreFromNailJson(ctx[col]));

        // 2) 결과가 하나도 없으면(전부 null) 이 날짜는 그래프에서 제외
        if (tmp.every(v => v === null)) continue;

        labels.push(dateStr);
        thumb.push(tmp[0] ?? null);
        indexF.push(tmp[1] ?? null);
        middle.push(tmp[2] ?? null);
        ring.push(tmp[3] ?? null);
        pinky.push(tmp[4] ?? null);
    }

    if (!labels.length) return null; // 전체에 데이터 없으면 null

    return { labels, thumb, indexF, middle, ring, pinky };
}

function renderHandLineChart(canvasId, series) {
    if (!series) return; // 데이터 없으면 그리지 않음
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    if (window[canvasId + "Chart"]) {
        window[canvasId + "Chart"].destroy();
    }

    window[canvasId + "Chart"] = new Chart(canvas, {
        type: "line",
        data: {
            labels: series.labels,
            datasets: [
                {
                    label: "Thumb",
                    data: series.thumb,
                    borderColor: "rgba(78,115,223,1)",
                    backgroundColor: "rgba(78,115,223,0.05)",
                    borderWidth: 2,
                    spanGaps: true,
                    tension: 0.3
                },
                {
                    label: "Index",
                    data: series.indexF,
                    borderColor: "rgba(28,200,138,1)",
                    backgroundColor: "rgba(28,200,138,0.05)",
                    borderWidth: 2,
                    spanGaps: true,
                    tension: 0.3
                },
                {
                    label: "Middle",
                    data: series.middle,
                    borderColor: "rgba(54,185,204,1)",
                    backgroundColor: "rgba(54,185,204,0.05)",
                    borderWidth: 2,
                    spanGaps: true,
                    tension: 0.3
                },
                {
                    label: "Ring",
                    data: series.ring,
                    borderColor: "rgba(246,194,62,1)",
                    backgroundColor: "rgba(246,194,62,0.05)",
                    borderWidth: 2,
                    spanGaps: true,
                    tension: 0.3
                },
                {
                    label: "Pinky",
                    data: series.pinky,
                    borderColor: "rgba(231,74,59,1)",
                    backgroundColor: "rgba(231,74,59,0.05)",
                    borderWidth: 2,
                    spanGaps: true,
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: "index",
                intersect: false
            },
            plugins: {
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function (ctx) {
                            const v = ctx.parsed.y;
                            if (v == null) return ctx.dataset.label + ": -";
                            return `${ctx.dataset.label}: ${v.toFixed(2)} %`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100
                }
            }
        }
    });
}

async function loadProgressionCharts() {
    const leftSeries = await buildHandAiSeries("l");
    const rightSeries = await buildHandAiSeries("r");

    renderHandLineChart("myAreaChart", leftSeries);
    renderHandLineChart("myAreaChart2", rightSeries);
}