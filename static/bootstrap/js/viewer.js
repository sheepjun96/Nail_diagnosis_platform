let originalPatient = null;

// Query Retrieval
function getQueryParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
}

const stlSeq = getQueryParam("stl_seq");
let currentSrlSeq = getQueryParam("srl_seq");
let viewerPatientId = null;

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

        // srl_seq 만 변경해서 동일 viewer 로 이동
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

    const note = data.context || "";
    const container = document.getElementById("patient_note_container");
    if (container) {
        container.textContent = note;
    }
}

document.addEventListener('DOMContentLoaded', function () {
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

    // 페이지 로드 시 호출
    loadPatientInfo().then(() => {
        loadSeriesListForViewer();
        loadPreview();
        loadPatientNote();
    });
});