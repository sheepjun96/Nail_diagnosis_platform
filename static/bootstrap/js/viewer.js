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
        const dateStr = row.date ? String(row.date).replace("T", " ").substring(0, 10) : "";
        const diagnosis = row.diagnosis_result || "-";

        tr.innerHTML = `
            <td>${row.no}</td>
            <td>${dateStr}</td>
            <td class="diagnosis-col">${diagnosis}</td>
            <td>${row.instance}</td>
        `;  
        if (String(row.srl_seq) === String(currentSrlSeq)) tr.classList.add("selected-row");
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

        const thumbUrl = getDynamicThumbUrl(cropUrl, null, 60);
        td.innerHTML = cropUrl
            ? `<img class="js-detail-image" src="${thumbUrl}" height="60px" />`
            : `<img class="js-detail-image" src="/static/imgs/Null.png" height="60px" />`;

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
                .map((url) => `<img class="js-detail-image" src="${getDynamicThumbUrl(url, null, 60)}" height="40px" style="margin:1px;" />`)
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
        // Normal Nail 이면 100 - p
        if (aiObj.predicted_class === "Normal Nail") {
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
    listItems.sort((a, b) => String(b.date).localeCompare(String(a.date)));

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

    if (!labels.length) return null;

    return { labels, thumb, indexF, middle, ring, pinky };
}

function renderHandLineChart(canvasId, series) {
    if (!series) return;
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

const fingerColumnMap = {
    lt: "srl_patient_l_t",
    li: "srl_patient_l_i",
    lm: "srl_patient_l_m",
    lR: "srl_patient_l_R",
    lp: "srl_patient_l_p",
    rt: "srl_patient_r_t",
    ri: "srl_patient_r_i",
    rm: "srl_patient_r_m",
    rR: "srl_patient_r_R",
    rp: "srl_patient_r_p",
};

async function onClickFingerProgress(fingerKey, fingerLabel) {
    if (!stlSeq) return;

    const header = document.getElementById("progress_finger_header");
    if (header) header.textContent = fingerLabel;

    const overlay = document.getElementById("progress_overlay");
    if (overlay) overlay.style.display = "none";

    const tbody = document.getElementById("finger_progress_body");
    if (!tbody) return;
    tbody.innerHTML = "";

    const listRes = await fetch(`/api/resource/series/list?patient_id=${encodeURIComponent(viewerPatientId)}`);
    const listData = await listRes.json();
    if (listData.code !== 200 || !listData.context) return;

    const listItems = [...listData.context].sort(
        (a, b) => new Date(b.srl_patient_seriesdate) - new Date(a.srl_patient_seriesdate)
    );

    const colKey = fingerColumnMap[fingerKey];
    if (!colKey) return;

    const labels = [];
    const aiSeries = [];
    const napsiSeries = [];
    const diseaseLabels = []; 

    for (const item of listItems) {
        const srlSeq = item.srl_seq;
        const dateStr = item.date ? String(item.date).substring(0, 10) : "-";

        const detailRes = await fetch(`/api/resource/series/detail?stl_seq=${encodeURIComponent(stlSeq)}&srl_seq=${encodeURIComponent(srlSeq)}`);
        const detailData = await detailRes.json();
        if (detailData.code !== 200 || !detailData.context) continue;
        const ctx = detailData.context;

        const noteRes = await fetch(`/api/resource/viewer/series_note?stl_seq=${encodeURIComponent(stlSeq)}&srl_seq=${encodeURIComponent(srlSeq)}`);
        let patientNote = "-";
        if (noteRes.ok) {
            const noteData = await noteRes.json();
            if (noteData.code === 200 && noteData.context != null) {
                patientNote = noteData.context || "-";
            }
        }

        const raw = ctx[colKey];

        let diseaseName = null;
        let cropUrl = null;
        let extraUrl = null;
        let plotUrl = null;
        let diagHtml = "";

        if (raw) {
            try {
                const nailObj = typeof raw === "string" ? JSON.parse(raw) : raw;
                const name = (nailObj.name || "").split("/").pop();

                if (name) {
                    cropUrl = `/api/resource/image/dump?filename=${encodeURIComponent(name)}&filetype=1`;
                    extraUrl = `/api/resource/image/dump?filename=${encodeURIComponent("extra_" + name)}&filetype=2`;
                    plotUrl = `/api/resource/image/dump?filename=${encodeURIComponent("plot_" + name)}&filetype=2`;
                }

                const { ai, napsi } = getAiProbAndNapsiTotal(nailObj);

                labels.push(dateStr);
                aiSeries.push(ai);
                napsiSeries.push(napsi);

                // AI score
                let aiObj = nailObj.ai;
                if (aiObj && typeof aiObj === "string") aiObj = JSON.parse(aiObj);
                if (aiObj) {
                    const prob =
                        aiObj.probability != null
                        ? (aiObj.probability * 100).toFixed(2)
                        : null;
                    diagHtml += `<div>${aiObj.predicted_class} (${prob ?? "-"}%)</div>`;
                    diseaseName = aiObj && aiObj.predicted_class ? aiObj.predicted_class: null;
                }
                diseaseLabels.push(diseaseName);

                // NAPSI total
                const psar = nailObj.psar || nailObj.psor || {};
                const matrix = psar.matrix ?? 0;
                const bed = psar.bed ?? 0;
                const total = Number(matrix || 0) + Number(bed || 0);
                napsiValue = total;

                diagHtml += `<div>NAPSI Matrix: ${matrix}</div>`;
                diagHtml += `<div>NAPSI Bed: ${bed}</div>`;
                diagHtml += `<div>NAPSI Total: ${total}</div>`;
            } catch (e) {
                console.error("finger json parse error", e);
            }
        } else {
            labels.push(dateStr);
            aiSeries.push(null);
            napsiSeries.push(null);
            diseaseLabels.push(null);
        }


        const trMain = document.createElement("tr");
        const trNote = document.createElement("tr");
        const imgSize = 120;

        // 1) Date
        const tdDate = document.createElement("td");
        tdDate.className = "p-1 fit-image";
        tdDate.rowSpan = 2;
        tdDate.textContent = dateStr || "-";
        trMain.appendChild(tdDate);

        // 2) Finger crop
        const tdCrop = document.createElement("td");
        tdCrop.className = "p-1 fit-image";
        if (cropUrl) {
            const img = document.createElement("img");
            img.height = imgSize;
            img.className = "js-detail-image";
            img.src = getDynamicThumbUrl(cropUrl, img, imgSize);
            tdCrop.appendChild(img);
        } else {
            tdCrop.textContent = "No image";
        }
        trMain.appendChild(tdCrop);

        // 3) Extra
        const tdExtra = document.createElement("td");
        tdExtra.className = "p-1 fit-image";
        if (extraUrl) {
            const img = document.createElement("img");
            img.height = imgSize;
            img.className = "js-detail-image";
            img.src = getDynamicThumbUrl(extraUrl, img, imgSize);
            img.onerror = () => (tdExtra.textContent = "No extra");
            tdExtra.appendChild(img);
        } else {
            tdExtra.textContent = "No extra";
        }
        trMain.appendChild(tdExtra);

        // 4) Plot
        const tdPlot = document.createElement("td");
        tdPlot.className = "p-1 fit-image";
        if (plotUrl) {
            const img = document.createElement("img");
            img.height = imgSize;
            img.className = "js-detail-image";
            img.src = getDynamicThumbUrl(plotUrl, img, imgSize);
            img.onerror = () => (tdPlot.textContent = "No plot");
            tdPlot.appendChild(img);
        } else {
            tdPlot.textContent = "No plot";
        }
        trMain.appendChild(tdPlot);

        // 5) Diagnosis
        const tdDiag = document.createElement("td");
        tdDiag.className = "p-1 text-left";
        tdDiag.innerHTML = diagHtml || "No diagnosis";
        trMain.appendChild(tdDiag);

        // 6) Patient Note
        const tdNote = document.createElement("td");
        tdNote.className = "p-1 text-left";
        tdNote.colSpan = 4;

        const span = document.createElement("span");
        span.className = "progress-note-text";

        const body = patientNote && patientNote.trim() ? patientNote : "-";
        span.textContent = "Patient Note: " + body;
        span.dataset.expanded = "false";
        span.classList.add("collapsed");

        span.addEventListener("click", () => {
            const isExpanded = span.dataset.expanded === "true";
            if (isExpanded) {
                span.classList.add("collapsed");
                span.dataset.expanded = "false";
            } else {
                span.classList.remove("collapsed");
                span.dataset.expanded = "true";
            }
        });

        tdNote.appendChild(span);
        trNote.appendChild(tdNote);

        tbody.appendChild(trMain);
        tbody.appendChild(trNote);
    }

    // 날짜 과거 -> 최신 순서로 정렬
    const revLabels = labels.slice().reverse();
    const revAi = aiSeries.slice().reverse();
    const revNapsi = napsiSeries.slice().reverse();
    const revDisLabels = diseaseLabels.slice().reverse();

    renderProgressLineChart("finger_progress_summary_chart", revLabels, revAi, revNapsi, revDisLabels);
}

function getAiProbAndNapsiTotal(nailJson) {
    if (!nailJson) return { ai: null, napsi: null };

    let nailObj = nailJson;
    if (typeof nailJson === "string") {
        try {
            nailObj = JSON.parse(nailJson);
        } catch (e) {
            console.error("nail json parse error", e);
            return { ai: null, napsi: null };
        }
    }

    // --- AI result ---
    let ai = null;
    if (nailObj.ai) {
        try {
            let aiObj = nailObj.ai;
            if (typeof aiObj === "string") {
                aiObj = JSON.parse(aiObj);
            }
            if (aiObj && aiObj.probability != null) {
                let p = aiObj.probability * 100;
                if (aiObj.predicted_class === "Normal Nail") {
                    p = 100 - p;
                }
                ai = Math.round(p * 100) / 100;
            }
        } catch (e) {
            console.error("ai parse error", e);
        }
    }

    // --- NAPSI Total ---
    let napsi = null;
    if (nailObj.psar) {
        const psar = nailObj.psar;
        const matrix = Number(psar.matrix ?? 0);
        const bed = Number(psar.bed ?? 0);
        napsi = matrix + bed;
    }

    return { ai, napsi };
}

function renderProgressLineChart(canvasId, labels, aiSeries, napsiSeries, diseaseLabels) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const key = canvasId + "Chart";
    if (window[key]) {
        window[key].destroy();
    }

    window[key] = new Chart(canvas, {
        type: "line",
        data: {
            labels: labels,
            datasets: [
                {
                    label: "AI score (%)",
                    data: aiSeries,
                    borderColor: "rgba(231,74,59,1)",
                    backgroundColor: "rgba(231,74,59,0.05)",
                    borderWidth: 2,
                    spanGaps: true,
                    lineTension: 0.3,
                    yAxisID: "yAi"
                },
                {
                    label: "NAPSI Total",
                    data: napsiSeries,
                    borderColor: "rgba(78,115,223,1)",
                    backgroundColor: "rgba(78,115,223,0.05)",
                    borderWidth: 2,
                    spanGaps: true,
                    lineTension: 0.3,
                    yAxisID: "yNapsi"
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            tooltips: {
                mode: "index",
                intersect: false,
                callbacks: {
                    label: function (tooltipItem, data) {
                        const ds = data.datasets[tooltipItem.datasetIndex];
                        const v = tooltipItem.yLabel;

                        if (ds.yAxisID === "yAi") {
                            const idx = tooltipItem.index;
                            const disease = diseaseLabels && diseaseLabels[idx] ? diseaseLabels[idx] : "None";
                            return disease + ": " + v.toFixed(2) + " %";
                        }

                        return ds.label + ": " + v.toFixed(0);
                    }
                }
            },
            hover: {
                mode: "index",
                intersect: false
            },
            scales: {
                xAxes: [{
                    display: true,
                    scaleLabel: {
                        display: true,
                        labelString: "Date"
                    }
                }],
                yAxes: [
                    {
                        id: "yAi",
                        type: "linear",
                        position: "left",
                        ticks: {
                            beginAtZero: true,
                            max: 100,
                            min: 0
                        },
                        scaleLabel: {
                            display: true,
                            labelString: "AI score (%)"
                        }
                    },
                    {
                        id: "yNapsi",
                        type: "linear",
                        position: "right",
                        ticks: {
                            beginAtZero: true,
                            max: 8,
                            min: 0
                        },
                        scaleLabel: {
                            display: true,
                            labelString: "NAPSI Total"
                        },
                        gridLines: {
                            drawOnChartArea: false
                        }
                    }
                ]
            }
        }
    });
}