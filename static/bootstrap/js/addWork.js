// 기본 상태
let currentPage = 1;
const defaultRows = 5;
let originCurrentPage = 1;
const originDefaultRows = 6;
let nailPsoriasis = false;
let nailJson = {}
let nailPsoriasisJson = {};
let psoriasisModal = null;

function initNailJson(){
    return {
        lt: {crop : "", extra : "", plot:"", ai: ""},
        li: {crop : "", extra : "", plot:"", ai: ""},
        lm: {crop : "", extra : "", plot:"", ai: ""},
        lr: {crop : "", extra : "", plot:"", ai: ""},
        lp: {crop : "", extra : "", plot:"", ai: ""},
        rt: {crop : "", extra : "", plot:"", ai: ""},
        ri: {crop : "", extra : "", plot:"", ai: ""},
        rm: {crop : "", extra : "", plot:"", ai: ""},
        rr: {crop : "", extra : "", plot:"", ai: ""},
        rp: {crop : "", extra : "", plot:"", ai: ""},
    }
}

function initnailPsoriasisJson(){
    return {
        lt : {
            index1 : {matrix : "",bed : ""},
            index2 : {matrix : "",bed : ""},
            index3 : {matrix : "",bed : ""},
            index4 : {matrix : "",bed : ""},
            matrix : 0,
            bed : 0
        },
        li : {
            index1 : {matrix : "",bed : ""},
            index2 : {matrix : "",bed : ""},
            index3 : {matrix : "",bed : ""},
            index4 : {matrix : "",bed : ""},
            matrix : 0,
            bed : 0
        },
        lm : {
            index1 : {matrix : "",bed : ""},
            index2 : {matrix : "",bed : ""},
            index3 : {matrix : "",bed : ""},
            index4 : {matrix : "",bed : ""},
            matrix : 0,
            bed : 0
        },
        lr : {
            index1 : {matrix : "",bed : ""},
            index2 : {matrix : "",bed : ""},
            index3 : {matrix : "",bed : ""},
            index4 : {matrix : "",bed : ""},
            matrix : 0,
            bed : 0
        },
        lp : {
            index1 : {matrix : "",bed : ""},
            index2 : {matrix : "",bed : ""},
            index3 : {matrix : "",bed : ""},
            index4 : {matrix : "",bed : ""},
            matrix : 0,
            bed : 0
        },
        rt : {
            index1 : {matrix : "",bed : ""},
            index2 : {matrix : "",bed : ""},
            index3 : {matrix : "",bed : ""},
            index4 : {matrix : "",bed : ""},
            matrix : 0,
            bed : 0
        },
        ri : {
            index1 : {matrix : "",bed : ""},
            index2 : {matrix : "",bed : ""},
            index3 : {matrix : "",bed : ""},
            index4 : {matrix : "",bed : ""},
            matrix : 0,
            bed : 0
        },
        rm : {
            index1 : {matrix : "",bed : ""},
            index2 : {matrix : "",bed : ""},
            index3 : {matrix : "",bed : ""},
            index4 : {matrix : "",bed : ""},
            matrix : 0,
            bed : 0
        },
        rr : {
            index1 : {matrix : "",bed : ""},
            index2 : {matrix : "",bed : ""},
            index3 : {matrix : "",bed : ""},
            index4 : {matrix : "",bed : ""},
            matrix : 0,
            bed : 0
        },
        rp : {
            index1 : {matrix : "",bed : ""},
            index2 : {matrix : "",bed : ""},
            index3 : {matrix : "",bed : ""},
            index4 : {matrix : "",bed : ""},
            matrix : 0,
            bed : 0
        }
    }
}

function getLocalDateTime() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
}

document.addEventListener('DOMContentLoaded', function () {
    nailPsoriasis = false;
    nailJson = initNailJson();
    nailPsoriasisJson = initnailPsoriasisJson();

    document.getElementById('add_patient_visit').value = getLocalDateTime();

    document.getElementById('add_patient_type').addEventListener('change', function () {
        if (this.value === 'new') {
            clearPatientFields();
        }
    });

    document.getElementById('main_search_input').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            currentPage = 1;
            loadStudyList(currentPage, defaultRows);
        }
    });

    document.getElementById('main_search_input').addEventListener('click', function () {
        currentPage = 1;
        loadStudyList(currentPage, defaultRows);
    });

    // Upload code
    const uploadBtn   = document.getElementById('upload_btn');
    const uploadInput = document.getElementById('upload_file_input');

    if (uploadBtn && uploadInput) {

        uploadBtn.addEventListener('click', function () {
            uploadInput.click();
        });

        uploadInput.addEventListener('change', async function () {
            if (!uploadInput.files || uploadInput.files.length === 0) {
                return;
            }

            const file = uploadInput.files[0];

            const formData = new FormData();
            formData.append('type', 'gcubme');
            formData.append('file', file);
            
            try {

                const resp = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData,
                });

                if (!resp.ok) {
                    const text = await resp.text().catch(() => '');
                    console.error('Upload failed status:', resp.status, resp.statusText, text);
                    alert('Upload failed (status: ' + resp.status + ')');
                    return;
                }

                const data = await resp.json();
                console.log('upload result:', data);
                alert('Upload success');

                if (typeof loadOriginImageList === 'function') {
                    loadOriginImageList(originCurrentPage, originDefaultRows);
                }
            } catch (err) {
                console.error('Upload error:', err);
                alert('Upload error');
            } finally {
                uploadInput.value = '';
            }
        });
    }

    loadStudyList(currentPage, defaultRows);
    loadOriginImageList(originCurrentPage, originDefaultRows);
});

// ------------------------------------------

window.addEventListener("load", () => {
    nailPsoriasis = false
    nailJson = initNailJson();
    nailPsoriasisJson = initnailPsoriasisJson();

    document.getElementById("add_patient_visit").value = getLocalDateTime();

    document.getElementById("add_patient_type").addEventListener("change", function () {
        if (this.value === "new") {
            clearPatientFields();
        }
    });
});

function onChangePsar(e) {
    nailPsoriasis = e.checked;
    const psoriasisRows = document.querySelectorAll('.psoriasis-func');
    if (nailPsoriasis) {
        psoriasisRows.forEach(row => row.classList.remove('none'));
        refreshNapsiColumns();
    } else {
        psoriasisRows.forEach(row => row.classList.add('none'));
    }
}

function refreshNapsiColumns() {
    if (!nailPsoriasis) {
        document.querySelectorAll('.psoriasis-func').forEach(row => row.classList.add('none'));
        return;
    }

    const leftKeys = ["lt", "li", "lm", "lr", "lp"];
    const rightKeys = ["rt", "ri", "rm", "rr", "rp"];

    const hasPsoriasis = (keys) => {
        return keys.some(key => {
            try {
                const aiData = nailJson[key].ai;
                return aiData ? JSON.parse(aiData).predicted_class === "Psoriasis" : false;
            } catch (e) { return false; }
        });
    };

    const leftHasPsar = hasPsoriasis(leftKeys);
    const rightHasPsar = hasPsoriasis(rightKeys);

    const leftRows = document.querySelectorAll('.psoriasis-left');
    const rightRows = document.querySelectorAll('.psoriasis-right');

    leftRows.forEach(row => leftHasPsar ? row.classList.remove('none') : row.classList.add('none'));
    rightRows.forEach(row => rightHasPsar ? row.classList.remove('none') : row.classList.add('none'));

    const allKeys = [...leftKeys, ...rightKeys];
    allKeys.forEach(key => {
        const colCells = document.querySelectorAll(`.psar-col-${key}`);
        let isPsar = false;
        try {
            const aiData = nailJson[key].ai;
            isPsar = aiData ? JSON.parse(aiData).predicted_class === "Psoriasis" : false;
        } catch (e) { isPsar = false; }

        colCells.forEach(cell => {
            if (isPsar) {
                cell.classList.remove('invisible-col');
            } else {
                cell.classList.add('invisible-col');
            }
        });
    });
}

function clearPatientFields() {
    document.getElementById("add_patient_id").value = "";
    document.getElementById("add_patient_name").value = "";
    document.getElementById("add_patient_gender").value = "M";
    document.getElementById("add_patient_birth").value = "";
    document.getElementById("add_patient_recent").textContent = "";
}

async function loadStudyList(page = 1, rows = defaultRows) {
    try {
        const searchInput = document.getElementById("main_search_input");
        const searchText = searchInput ? searchInput.value.trim() : "";

        const params = new URLSearchParams({
            page: page.toString(),
            rows: rows.toString()
        });

        if (searchText) {
            params.append("search", searchText);
        }

        const res = await fetch(`/api/resource/study/list?${params.toString()}`, {
            method: "GET",
            headers: {
                "Accept": "application/json"
            }
        });

        if (!res.ok) {
            console.error("API 응답 오류:", res.status, res.statusText);
            return;
        }

        const data = await res.json();

        if (data.code !== 200) {
            console.error("API 응답 코드 에러:", data);
            return;
        }

        const tbody = document.getElementById("member_resource_list");
        if (!tbody) {
            console.error("tbody#member_resource_list 를 찾을 수 없습니다.");
            return;
        }

        // 기존 목록 초기화
        tbody.innerHTML = "";

        const items = data.context || [];
        const total = data.total || 0;
        const current = data.page || page;
        const size = data.rows || rows;

            items.forEach((row, index) => {
            const tr = document.createElement("tr");

            const birth = row.stl_patient_birthdate
                ? row.stl_patient_birthdate.substring(0, 10)
                : "";
            const studyDate = row.stl_patient_studydate
                ? row.stl_patient_studydate.replace("T", " ").substring(0, 19)
                : "";
            const recentDate = row.stl_patient_recentdate
                ? row.stl_patient_recentdate.replace("T", " ").substring(0, 19)
                : "";

            tr.innerHTML = `
                <td>${(current - 1) * size + index + 1}</td>
                <td>${row.stl_patient_id ?? ""}</td>
                <td>${row.stl_patient_name ?? ""}</td>
                <td>${row.stl_patient_gender ?? ""}</td>
                <td>${birth}</td>
                <td>${studyDate}</td>
                <td>${recentDate}</td>
            `;

            tr.classList.add("pointer")

            tr.addEventListener("click", () => {
                const allRows = tbody.querySelectorAll("tr");
                allRows.forEach(r => r.classList.remove("table-click"));

                tr.classList.add("table-click");
                fillPatientInfoFromWorklist(row);
            });

            tbody.appendChild(tr);
        });

            // 페이지네이션 렌더링
        renderPagination(total, current, size);

        // 현재 페이지 전역 업데이트
        currentPage = current;

    } catch (err) {
        console.error("study list 로딩 중 에러:", err);
    }
}

function renderPagination(total, page, rows) {
    const totalPages = Math.max(1, Math.ceil(total / rows));
    const pagination = document.getElementById("member_pagination");
    if (!pagination) return;

    pagination.innerHTML = "";

    // 페이지가 1개 뿐이면 페이지네이션 안 그려도 됨
    // if (totalPages <= 1) return;

    const createPageItem = (label, targetPage, disabled = false, active = false) => {
        const li = document.createElement("li");
        li.classList.add("page-item");
        if (disabled) li.classList.add("disabled");
        if (active) li.classList.add("active");

        const a = document.createElement("a");
        a.classList.add("page-link");
        a.href = "#";
        a.textContent = label;

        if (!disabled && !active) {
            a.addEventListener("click", (e) => {
                e.preventDefault();
                loadStudyList(targetPage, rows);
            });
        }

        li.appendChild(a);
        return li;
    };

    // « 이전
    pagination.appendChild(
        createPageItem("«", page - 1, page <= 1)
    );

    // 페이지 번호 (필요하면 window 범위 조절 가능)
    const windowSize = 5; // 한 번에 보여줄 최대 페이지 수
    let start = Math.max(1, page - Math.floor(windowSize / 2));
    let end = Math.min(totalPages, start + windowSize - 1);
    if (end - start + 1 < windowSize) {
        start = Math.max(1, end - windowSize + 1);
    }

    for (let p = start; p <= end; p++) {
        pagination.appendChild(
            createPageItem(p.toString(), p, false, p === page)
        );
    }

    // » 다음
    pagination.appendChild(
        createPageItem("»", page + 1, page >= totalPages)
    );
}

async function loadOriginImageList(page = 1, rows = originDefaultRows) {
    try {
        const params = new URLSearchParams({
            page: page.toString(),
            rows: rows.toString(),
            image_type: 0          // 0 = origin 타입
        });

        const res = await fetch(`/api/resource/image/origin/list?${params.toString()}`, {
            method: "GET",
            headers: { "Accept": "application/json" }
        });

        if (!res.ok) {
            console.error("API 응답 오류:", res.status, res.statusText);
            return;
        }

        const data = await res.json();

        if (data.code !== 200) {
            console.error("API 코드 오류:", data);
            return;
        }

        const tbody = document.getElementById("origin_resource_list");
        if (!tbody) return;

        tbody.innerHTML = "";

        const items = data.context || [];
        const total = data.total || 0;
        const current = data.page || page;
        const size = data.rows || rows;

        items.forEach((row, index) => {
            const tr = document.createElement("tr");

            const createDate = row.uf_upload_date
                ? row.uf_upload_date.replace("T", " ").substring(2, 19)
                : "";

            const filename = row.uf_uri ? row.uf_uri.split("/").pop() : "";
            const rawUrl = `/api/resource/image/dump?filename=${filename}&filetype=0`;
            const thumbUrl = getDynamicThumbUrl(rawUrl, null, 80);
            tr.innerHTML = `
                <td>${(current - 1) * size + index + 1}</td>
                <td>
                    <img src="${thumbUrl}" height="30" class="mr-2" style="object-fit: contain;">
                    ${filename}
                </td>
                <td>${createDate}</td>
            `;

            tr.addEventListener("click", () => {
                const allRows = tbody.querySelectorAll("tr");
                allRows.forEach(r => r.classList.remove("table-click"));

                tr.classList.add("table-click");
                filselectOriginCropImage(row);
            });

            tr.classList.add("pointer")

            tbody.appendChild(tr);
        });

        renderOriginPagination(total, current, size);
        originCurrentPage = current;

    } catch (error) {
        console.error("origin image list 로딩 오류:", error);
    }
}

// === Pagination Renderer === //
function renderOriginPagination(total, page, rows) {
    const totalPages = Math.max(1, Math.ceil(total / rows));
    const pagination = document.getElementById("origin_resource_pagination");
    if (!pagination) return;

    pagination.innerHTML = "";

    if (totalPages <= 1) return;

    const createPageItem = (label, targetPage, disabled = false, active = false) => {
        const li = document.createElement("li");
        li.classList.add("page-item");

        if (disabled) li.classList.add("disabled");
        if (active) li.classList.add("active");

        const a = document.createElement("a");
        a.classList.add("page-link");
        a.href = "#";
        a.textContent = label;

        if (!disabled && !active) {
            a.addEventListener("click", (e) => {
                e.preventDefault();
                loadOriginImageList(targetPage, rows);
            });
        }

        li.appendChild(a);
        return li;
    };

    // « 이전
    pagination.appendChild(createPageItem("«", page - 1, page <= 1));

    // 페이지 번호 세트 (5개 window)
    const windowSize = 5;
    let start = Math.max(1, page - Math.floor(windowSize / 2));
    let end = Math.min(totalPages, start + windowSize - 1);

    if (end - start + 1 < windowSize) {
        start = Math.max(1, end - windowSize + 1);
    }

    for (let p = start; p <= end; p++) {
        pagination.appendChild(createPageItem(p, p, false, p === page));
    }

    // » 다음
    pagination.appendChild(createPageItem("»", page + 1, page >= totalPages));
}

function fillPatientInfoFromWorklist(row) {
    const typeEl = document.querySelector("select#add_patient_type");
    if (typeEl) {
        typeEl.value = "exist";
    }

    // ID
    const idEl = document.getElementById("add_patient_id");
    if (idEl) idEl.value = row.stl_patient_id || "";

    // Name
    const nameEl = document.getElementById("add_patient_name");
    if (nameEl) nameEl.value = row.stl_patient_name || "";

    // Gender
    const genderEl = document.querySelector("#add_patient_gender");
    if (genderEl) {
        const gender = row.stl_patient_gender || "M";
        genderEl.value = gender;
    }

    // Birthday (date input은 'YYYY-MM-DD' 만 가능)
    const birthEl = document.getElementById("add_patient_birth");
    if (birthEl) {
        const birth = row.stl_patient_birthdate
            ? row.stl_patient_birthdate.substring(0, 10)
            : "";
        birthEl.value = birth;
    }

    // Recent study date
    const recentEl = document.getElementById("add_patient_recent");
    if (recentEl) {
        const recent = row.stl_patient_recentdate
            ? row.stl_patient_recentdate.replace("T", " ").substring(0, 19)
            : "";
        recentEl.textContent = recent;
    }           

}

async function filselectOriginCropImage(row) {
    const params = new URLSearchParams({
        filename: row?.uf_uri,
    });

    const res = await fetch(`/api/resource/image/origin/detail?${params.toString()}`, {
        method: "GET",
        headers: { "Accept": "application/json" }
    });

    if (!res.ok) {
        console.error("API 응답 오류:", res.status, res.statusText);
        return;
    }

    const data = await res.json();

    if (data.code !== 200) {
        console.error("API 코드 오류:", data);
        return;
    }

    const result = {
        origin_uri: null,
        crop_thumb_l_uri: null,
        crop_index_l_uri: null,
        crop_middle_l_uri: null,
        crop_ring_l_uri: null,
        crop_pinky_l_uri: null,
        crop_thumb_r_uri: null,
        crop_index_r_uri: null,
        crop_middle_r_uri: null,
        crop_ring_r_uri: null,
        crop_pinky_r_uri: null,
        crop_thumb_l_ai: null,
        crop_index_l_ai: null,
        crop_middle_l_ai: null,
        crop_ring_l_ai: null,
        crop_pinky_l_ai: null,
        crop_thumb_r_ai: null,
        crop_index_r_ai: null,
        crop_middle_r_ai: null,
        crop_ring_r_ai: null,
        crop_pinky_r_ai: null,
    };

    const baseUri = data.base;

    data.context.forEach(item => {

        // 1) origin 이미지
        if (item.uf_filetype === 0) {
            result.origin_uri = baseUri+"?filename="+item.uf_uri+"&filetype="+item.uf_filetype;
        }

        // 2) crop 이미지
        if (item.uf_filetype === 1) {
            const memo = item.uf_memo_1?.toLowerCase();

            if (memo == "lt") {result.crop_thumb_l_uri = baseUri+"?filename="+item.uf_uri+"&filetype="+item.uf_filetype;result.crop_thumb_l_ai = item.uf_memo_4}
            if (memo == "li") {result.crop_index_l_uri = baseUri+"?filename="+item.uf_uri+"&filetype="+item.uf_filetype;result.crop_index_l_ai = item.uf_memo_4}
            if (memo == "lm") {result.crop_middle_l_uri = baseUri+"?filename="+item.uf_uri+"&filetype="+item.uf_filetype;result.crop_middle_l_ai = item.uf_memo_4}
            if (memo == "lr") {result.crop_ring_l_uri = baseUri+"?filename="+item.uf_uri+"&filetype="+item.uf_filetype;result.crop_ring_l_ai = item.uf_memo_4}
            if (memo == "lp") {result.crop_pinky_l_uri = baseUri+"?filename="+item.uf_uri+"&filetype="+item.uf_filetype;result.crop_pinky_l_ai = item.uf_memo_4}
            if (memo == "rt") {result.crop_thumb_r_uri = baseUri+"?filename="+item.uf_uri+"&filetype="+item.uf_filetype;result.crop_thumb_r_ai = item.uf_memo_4}
            if (memo == "ri") {result.crop_index_r_uri = baseUri+"?filename="+item.uf_uri+"&filetype="+item.uf_filetype;result.crop_index_r_ai = item.uf_memo_4}
            if (memo == "rm") {result.crop_middle_r_uri = baseUri+"?filename="+item.uf_uri+"&filetype="+item.uf_filetype;result.crop_middle_r_ai = item.uf_memo_4}
            if (memo == "rr") {result.crop_ring_r_uri = baseUri+"?filename="+item.uf_uri+"&filetype="+item.uf_filetype;result.crop_ring_r_ai = item.uf_memo_4}
            if (memo == "rp") {result.crop_pinky_r_uri = baseUri+"?filename="+item.uf_uri+"&filetype="+item.uf_filetype;result.crop_pinky_r_ai = item.uf_memo_4}
        }
    });

    const originDiv = document.getElementById("select_origin_image");
    if (originDiv) {
        if (result?.origin_uri) { // 실제 필드명에 맞게 수정
            const originWidth = originDiv.clientWidth || 500;
            originDiv.innerHTML = `
                <img 
                class="fit-image-width js-detail-image thumb-image" 
                src="${getDynamicThumbUrl(result.origin_uri, originDiv, originWidth)}" 
                width="100%" 
                height="100%" 
                alt="origin"
                />
            `;
        } else {
            originDiv.innerHTML = `<span>No image</span>`;
        }
    }
    const selectCropList = ["t_l", "i_l", "m_l", "r_l", "p_l", "t_r", "i_r", "m_r", "r_r", "p_r"]
    selectCropList.forEach(item => {
        const elementId = "select_crop_"+item
        let imageUri = ""
        let imageAi = ""
        const tDiv = document.getElementById(elementId);
        const dDiv = document.getElementById(elementId+"_d");
        const bDiv = document.getElementById(elementId+"_b");
        const inputAi = document.getElementById(elementId+"_ai");
        if (item == "t_l") {imageUri = result?.crop_thumb_l_uri;imageAi = result?.crop_thumb_l_ai;}
        if (item == "i_l") {imageUri = result?.crop_index_l_uri;imageAi = result?.crop_index_l_ai;}
        if (item == "m_l") {imageUri = result?.crop_middle_l_uri;imageAi = result?.crop_middle_l_ai;}
        if (item == "r_l") {imageUri = result?.crop_ring_l_uri;imageAi = result?.crop_ring_l_ai;}
        if (item == "p_l") {imageUri = result?.crop_pinky_l_uri;imageAi = result?.crop_pinky_l_ai;}
        if (item == "t_r") {imageUri = result?.crop_thumb_r_uri;imageAi = result?.crop_thumb_r_ai;}
        if (item == "i_r") {imageUri = result?.crop_index_r_uri;imageAi = result?.crop_index_r_ai;}
        if (item == "m_r") {imageUri = result?.crop_middle_r_uri;imageAi = result?.crop_middle_r_ai;}
        if (item == "r_r") {imageUri = result?.crop_ring_r_uri;imageAi = result?.crop_ring_r_ai;}
        if (item == "p_r") {imageUri = result?.crop_pinky_r_uri;imageAi = result?.crop_pinky_r_ai;}

        if (tDiv) {
            if (imageUri) { // 실제 필드명에 맞게 수정
                const thumbWidth = tDiv.clientWidth || 150;
                tDiv.innerHTML = `
                    <img 
                    class="fit-image" 
                    src="${getDynamicThumbUrl(imageUri, tDiv, thumbWidth)}" 
                    height="60px"
                    alt="crop image ${item}"
                    />
                `;

            } else {
                tDiv.innerHTML = `<span>No image</span>`;
            }
        }

        if(dDiv){
            if (imageUri) { 
                const buttons = dDiv.querySelectorAll("button");
                buttons.forEach(btn => btn.classList.remove("none"));
            }else{
                const buttons = dDiv.querySelectorAll("button");
                buttons.forEach(btn => btn.classList.add("none"));
            }
        }

        if(bDiv){
            if (imageUri) {
                const buttons = bDiv.querySelectorAll("button");
                buttons.forEach(btn => btn.classList.remove("none"));
            }else{
                const buttons = bDiv.querySelectorAll("button");
                buttons.forEach(btn => btn.classList.add("none"));
            }
        }

        if(inputAi){
            inputAi.value = imageAi
        }
    });

    const applyBtn = document.getElementById("apply_all_btn");
    if (applyBtn) {
        if (result.origin_uri) {
            applyBtn.classList.remove("d-none");
        } else {
            applyBtn.classList.add("d-none");
        }
    }
}

function popupDetailViewer(cellId) {
    const cell = document.getElementById(cellId);
    if (!cell) {
        alert("이미지 셀을 찾을 수 없습니다.");
        return;
    }

    // 2) 내부의 img 태그 찾기
    const img = cell.querySelector("img");
    if (!img || !img.src) {
        alert("표시할 이미지가 없습니다.");
        return;
    }

    const url = new URL(img.src);
    const queryString = url.search;
    const popupUrl = `/app/image${queryString}`;
    const win = window.open(
        popupUrl,
        "_blank",
        "width=900,height=800,menubar=no,toolbar=no,location=no,status=no,scrollbars=yes"
    );

    if (!win) {
        alert("팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요.");
        return;
    }
}

function onSelectImageDatas(imageUri, type, total_insert=false){
    const typeMap = {
        lt : "image_data_t_l",
        li : "image_data_i_l",
        lm : "image_data_m_l",
        lr : "image_data_r_l",
        lp : "image_data_p_l",
        rt : "image_data_t_r",
        ri : "image_data_i_r",
        rm : "image_data_m_r",
        rr : "image_data_r_r",
        rp : "image_data_p_r",
    }
    const positionMap = {
        lt : "left & Thumb",
        li : "left & Index",
        lm : "left & Middle",
        lr : "left & Ring",
        lp : "left & Pinky",
        rt : "right & Thumb",
        ri : "right & Index",
        rm : "right & Middle",
        rr : "right & Ring",
        rp : "right & Pinky",
    }
    const imageDataId = typeMap[type]
    const imgTd = document.getElementById(imageUri);
    const aiElement = document.getElementById(imageUri+"_ai");
    const img = imgTd.querySelector("img");

    const aiResult = JSON.parse(aiElement.value ? aiElement.value : "{}");

    const processSelection = () => {
        const selectImageAi = imageDataId + "_ai";
        const selectTd = document.getElementById(imageDataId);
        const seletImg = selectTd.querySelector("img");
        
        const rawUrl = img.src.split('&width=')[0]; 
        seletImg.src = getDynamicThumbUrl(rawUrl, selectTd, 150);
        nailJson[type].crop = img.src;

        renderAiEditableUI(type, selectImageAi, aiResult);

        const url = new URL(img.src);
        url.searchParams.set("filename", "plot_" + url.searchParams.get("filename"));
        url.searchParams.set("filetype", "4");
        nailJson[type].plot = url.toString();
    };

    if(!total_insert){
        if(confirm("Are you sure you want to select this image?\nSelected : " + positionMap[type])){
            processSelection();
        }
    } else {
        processSelection();
    }
}

function onDeleteSelectImage(imageUri, type){
    const selected = nailJson[type].crop;
    if(selected && confirm("Are you sure you want to permanently delete this data?")){
        const imgTd = document.getElementById(imageUri);
        const seletImg = imgTd.querySelector("img");
        seletImg.src = "/static/imgs/add_placeholder.png";
        
        const extraImgTd = document.getElementById(imageUri+"_e");      
        const extraSeletImg = extraImgTd.querySelector("img");
        extraSeletImg.src = "/static/imgs/add_placeholder.png";     
        
        nailJson[type] = {crop : "", extra : "", plot:"", ai:""};
        nailPsoriasisJson[type] = {
            index1 : {matrix : "", bed : ""},
            index2 : {matrix : "", bed : ""},
            index3 : {matrix : "", bed : ""},
            index4 : {matrix : "", bed : ""},
            matrix : 0, bed : 0
        };

        const selectImageAi = imageUri + "_ai";
        const selectInputAi = document.getElementById(selectImageAi);
        if (selectInputAi) {
            selectInputAi.innerHTML = '';
        }
    }
}

function onExtraImageAdd(targetId, type) {
    const fileInput = document.getElementById(targetId+"_input");

    // 1) 파일 선택 이벤트 핸들러 설정
    fileInput.onchange = function (event) {
        const file = event.target.files[0];
        if (!file) return;

        // png/jpg 제한 체크
        if (!file.type.match(/image\/(png|jpeg)/)) {
            alert("PNG 또는 JPG 이미지만 선택할 수 있습니다.");
            return;
        }

        // 2) 이미지 미리보기 URL 생성
        const imgURL = URL.createObjectURL(file);

        // 3) 해당 td 내부의 img src 변경
        const targetTd = document.getElementById(targetId);
        const imgTag = targetTd.querySelector("img");
        if (imgTag) {
            imgTag.src = imgURL;
            nailJson[type].extra = imgURL
        }
    };

    // 4) 파일 선택창 열기
    fileInput.click();
}

function onSelectAllImageDatas() {
    const keys = ["lt", "li", "lm", "lr", "lp", "rt", "ri", "rm", "rr", "rp"];

    const imageUriMap = {
        lt: "select_crop_t_l",
        li: "select_crop_i_l",
        lm: "select_crop_m_l",
        lr: "select_crop_r_l",
        lp: "select_crop_p_l",
        rt: "select_crop_t_r",
        ri: "select_crop_i_r",
        rm: "select_crop_m_r",
        rr: "select_crop_r_r",
        rp: "select_crop_p_r",
    };

    const applicable = [];
    for (const k of keys) {
        const imageUri = imageUriMap[k];
        const imgTd = document.getElementById(imageUri);
        if (!imgTd) continue;

        const img = imgTd.querySelector("img");
        if (!img || !img.src) continue;

        applicable.push({ type: k, imageUri });
    }

    if (!applicable.length) {
        alert("There is no image to apply.");
        return;
    }

    if (!confirm("Apply current images to all visible positions?")) {
        return;
    }

    applicable.forEach(({ type, imageUri }) => {
        onSelectImageDatas(imageUri, type, total_insert=true);
    });
}

function onClickOriginImage(imageUrl) {
    const wrapper = document.getElementById("select_origin_image");
    wrapper.innerHTML = "";

    const img = document.createElement("img");
    img.src = imageUrl;
    img.alt = "Selected origin image";
    wrapper.appendChild(img);

    const applyBtn = document.getElementById("apply_all_btn");
    if (applyBtn) {
        applyBtn.classList.remove("d-none");
    }
}

function openPsoriasisModal(value, type) {
    const selectJson = nailJson[type]

    if(!selectJson.crop || selectJson.crop?.includes("placeholder")){
        alert("선택된 이미지가 없습니다.")
        return
    }
    
    const modalImage = document.getElementById("modal_select_image_plot")
    modalImage.src = getDynamicThumbUrl(selectJson.plot, modalImage, 400);
    modalImage.classList.add("js-detail-image");

    const titleEl = document.getElementById("psoriasisModalLabel");
    const bodyEl  = document.getElementById("psoriasisModalBodyText");

    if (titleEl) {
        titleEl.textContent = "Psoriasis Position: " + value;
    }
    if (bodyEl) {
        bodyEl.textContent = "select Psoriasis Position: " + value;
    }

    const parSelectNo  = document.getElementById("psar_select_no");
    parSelectNo.value = value
    const parSelectType  = document.getElementById("psar_select_type");
    parSelectType.value = type

    let matrixValues = [];
    let bedValues = [];
    const indexString = "index"+value
    if(nailPsoriasisJson[type][indexString]?.matrix || nailPsoriasisJson[type][indexString]?.bed){
        const temp_matrix = matrixValues.concat(nailPsoriasisJson[type][indexString].matrix.split(","))
        if(temp_matrix && temp_matrix.length > 0){
            matrixValues = matrixValues.concat(temp_matrix)
        }
        const temp_bed = bedValues.concat(nailPsoriasisJson[type][indexString].bed.split(","))
        if(temp_bed && temp_bed.length > 0){
            bedValues = bedValues.concat(temp_bed)
        }
        
        const matrixContainer = document.getElementById("psar_select_matrix");
        if(matrixValues.length < 1){
            matrixContainer.innerHTML = "";
        }else{
            matrixValues.forEach(matrix=>{
                const exists = matrixContainer.querySelector(`[data-value="${value}"]`);
                if (exists) return;
                if(matrix){
                    const badge = document.createElement("span");
                    badge.classList.add("psar-badge");
                    badge.setAttribute("data-value", matrix);
                    badge.textContent = matrix;

                    const removeBtn = document.createElement("span");
                    removeBtn.classList.add("psar-remove-btn");
                    removeBtn.innerHTML = "&times;";
                    removeBtn.onclick = function () {
                        badge.remove();
                    };

                    badge.appendChild(removeBtn);
                    matrixContainer.appendChild(badge);
                }
            })
        }
        
        const bedContainer    = document.getElementById("psar_select_bed");
        if(bedValues.length < 1){
            matrixContainer.innerHTML = "";
        }else{
            bedValues.forEach(bad=>{
                const exists = bedContainer.querySelector(`[data-value="${value}"]`);
                if (exists) return;
                if (bad){
                    const badge = document.createElement("span");
                    badge.classList.add("psar-badge");
                    badge.setAttribute("data-value", bad);
                    badge.textContent = bad;

                    const removeBtn = document.createElement("span");
                    removeBtn.classList.add("psar-remove-btn");
                    removeBtn.innerHTML = "&times;";
                    removeBtn.onclick = function () {
                        badge.remove();
                    };

                    badge.appendChild(removeBtn);
                    bedContainer.appendChild(badge);
                }
            })
        }
    }

    const modalEl = document.getElementById("psoriasisModal");
    psoriasisModal = new bootstrap.Modal(modalEl);
    if(psoriasisModal) psoriasisModal.show();
}

function onSelectPsar(type, value) {
    const targetId = type === "matrix" ? "psar_select_matrix" : "psar_select_bed";
    const container = document.getElementById(targetId);

    // 중복 방지
    const exists = container.querySelector(`[data-value="${value}"]`);
    if (exists) return;

    const badge = document.createElement("span");
    badge.classList.add("psar-badge");
    badge.setAttribute("data-value", value);
    badge.textContent = value;

    const removeBtn = document.createElement("span");
    removeBtn.classList.add("psar-remove-btn");
    removeBtn.innerHTML = "&times;";
    removeBtn.onclick = function () {
        badge.remove();
    };

    badge.appendChild(removeBtn);
    container.appendChild(badge);
}

function onSaveSelectPsar() {
    const parSelectNo   = document.getElementById("psar_select_no");  
    const parSelectType = document.getElementById("psar_select_type"); 

    const psarNo  = parSelectNo ? parSelectNo.value : "";
    const psarType = parSelectType ? parSelectType.value : "";
    const psarIndex = "index"+psarNo

    if (!psarNo || !psarType) {
        alert("대상 손톱(no) 또는 index(type) 정보가 없습니다.");
        return;
    }

    const matrixContainer = document.getElementById("psar_select_matrix");
    const bedContainer    = document.getElementById("psar_select_bed");

    if (!matrixContainer || !bedContainer) return;

    const matrixList = matrixContainer.querySelectorAll(".psar-badge");
    const bedList    = bedContainer.querySelectorAll(".psar-badge");

    const matrixValues = [];
    matrixList.forEach(badge => {
        const val = badge.getAttribute("data-value");
        if (val) matrixValues.push(val);
    });
    nailPsoriasisJson[psarType][psarIndex].matrix = matrixValues.join(",");

    const bedValues = [];
    bedList.forEach(badge => {
        const val = badge.getAttribute("data-value");
        if (val) bedValues.push(val);
    });
    nailPsoriasisJson[psarType][psarIndex].bed = bedValues.join(",");

    let matrix_count = 0
    let bed_count = 0
    const indexList = ["index1", "index2", "index3", "index4"]
    indexList.forEach(k=>{
        if(nailPsoriasisJson[psarType][k].matrix){
            matrix_count++
        }
        if(nailPsoriasisJson[psarType][k].bed){
            bed_count++
        }
    })

    nailPsoriasisJson[psarType].matrix = matrix_count
    nailPsoriasisJson[psarType].bed = bed_count

    matrixContainer.innerHTML = "";
    bedContainer.innerHTML    = "";

    onChangePsarIndex(psarNo, psarType)

    if(psoriasisModal) psoriasisModal.hide();
}

function onCloseSelectPsar(){
    const matrixContainer = document.getElementById("psar_select_matrix");
    const bedContainer    = document.getElementById("psar_select_bed");
    matrixContainer.innerHTML = "";
    bedContainer.innerHTML    = "";

    if(psoriasisModal) psoriasisModal.hide();
}

function onChangePsarIndex(index, type){
    const mSpan = document.getElementById(`psar_${type}_${index}_m`);
    const bSpan = document.getElementById(`psar_${type}_${index}_b`);
    const indexString = "index"+index
    const paramData = nailPsoriasisJson[type]

    if (mSpan) {
        mSpan.setAttribute("title", paramData[indexString].matrix || "");
        mSpan.textContent = paramData[indexString].matrix ? "1" : "0";
        refreshTooltip(mSpan);
    }

    if (bSpan) {
        bSpan.setAttribute("title", paramData[indexString].bed || "");
        bSpan.textContent = paramData[indexString].bed ? "1" : "0";
        refreshTooltip(bSpan);
    }

    
    const mTotalSpan = document.getElementById(`psar_${type}_total_m`);
    if (mTotalSpan) {
        mTotalSpan.setAttribute("title", paramData.matrix || "0");
        mTotalSpan.textContent = paramData.matrix;
    }
    const bTotalSpan = document.getElementById(`psar_${type}_total_b`);
        if (bTotalSpan) {
        bTotalSpan.setAttribute("title", paramData.bed || "0");
        bTotalSpan.textContent = paramData.bed;
    }
    const tTotalSpan = document.getElementById(`psar_${type}_total_t`);
    if (tTotalSpan) {
        tTotalSpan.setAttribute("title",  paramData.matrix + paramData.bed || "0");
        tTotalSpan.textContent = paramData.matrix + paramData.bed;
    }
}

function refreshTooltip(el) {
    $(el).tooltip('dispose');
    $(el).tooltip();
}

function onChangePatientNote(e){
    let targetText = e.value;
    targetText = targetText.replace(/[<>&"'`;]/g, "");

    if(targetText.length > 500){
        targetText = targetText.substring(0, 500)
    }
    e.value = targetText
}

$('[data-toggle="tooltip"]').tooltip();

async function onCompleteAddPatient(){
    const patientId   = document.getElementById("add_patient_id")?.value.trim() || "";
    const patientName   = document.getElementById("add_patient_name")?.value.trim() || "";
    const patientGender = document.getElementById("add_patient_gender")?.value || "";
    const patientBirth  = document.getElementById("add_patient_birth")?.value || "";
    const patientVisit  = document.getElementById("add_patient_visit")?.value || "";
    const patientNote   = document.getElementById("add-patient-note")?.value || "";
    const patientAddtype = document.querySelector("select#add_patient_type")?.value || "";

    const confirmAdd = confirm("Do you want to register this patient?");
    if (!confirmAdd) return;

    const missingFields = [];
    if (!patientAddtype) missingFields.push("Type");
    if (!patientId) missingFields.push("ID");
    if (!patientName) missingFields.push("Name");
    if (!patientGender) missingFields.push("Gender");
    if (!patientBirth) missingFields.push("Birthday");

    if (missingFields.length > 0) {
        alert("The following fields are required:\n" + missingFields.join(", "));
        return;
    } 

    const nailIndexList = [
        "patient_l_t", "patient_l_i", "patient_l_m", "patient_l_r", "patient_l_p",
        "patient_r_t", "patient_r_i", "patient_r_m", "patient_r_r", "patient_r_p"
    ]

    let nailBody = {}
    nailIndexList.forEach((element, index)=>{
        const targetType = element.replace("patient_", "").replace("_", "")
        const nailInfo = nailJson[targetType]
        const nailPsoriasisInfo = nailPsoriasisJson[targetType] || {
            index1: { matrix: "", bed: "" },
            index2: { matrix: "", bed: "" },
            index3: { matrix: "", bed: "" },
            index4: { matrix: "", bed: "" },
            matrix: 0,
            bed: 0
        };

        const cropUri = nailInfo?.crop ? new URL(nailInfo?.crop) : undefined;
        const onlyPath = cropUri ? cropUri.pathname + cropUri.search: "";
        const filename = cropUri ? cropUri.searchParams.get("filename") : "";
        const originFilename = filename ? filename.split("_").slice(2).join("_") : "";

        const psarUri = nailInfo?.sar ? new URL(nailInfo?.sar) : undefined;
        const psarPath = psarUri ? psarUri.pathname + psarUri.search : "";

        const extraList = nailInfo?.extra ? [nailInfo?.extra] : []              
        const aiResult = nailInfo?.ai ? nailInfo?.ai : ""              


        nailBody[element] = {
            origin : originFilename,
            name : filename,
            crop : onlyPath || "",
            plot : psarPath || "",
            psar : nailPsoriasisInfo,
            extra : extraList,
            ai : aiResult
        }
    })

    const body ={
        addType : patientAddtype,
        patientId : patientId,
        patientName : patientName,
        patientGender : patientGender,
        patientBirth : patientBirth,
        patientVisit : patientVisit,
        patientNote : patientNote,
        nail : nailBody
    }

    const formData = new FormData();
    formData.append("body", JSON.stringify(body));

    for (const element of nailIndexList){
        const targetType = element.replace("patient_", "").replace("_", "")
        const nailInfo = body?.nail?.[element]
        if (!nailInfo || !Array.isArray(nailInfo.extra)) continue;

        for (let i = 0; i < nailInfo.extra.length; i++) {
            const blobUrl = nailInfo.extra[i];
            if (!blobUrl || !blobUrl.startsWith("blob:")) continue;

            try {
                const res = await fetch(blobUrl);
                const blob = await res.blob();

                // 파일 이름 결정 (없으면 fallback)
                let fileName = nailInfo.name || `${element}_${i}.png`;

                const fieldName = `${element}`;

                formData.append(fieldName, blob, fileName);
            } catch (err) {
                console.error("Failed to get blob for", element, blobUrl, err);
            }
        }
    }

    const response = await fetch("/api/resource/patient/add", {
        method: "POST",
        body: formData,   //  Content-Type 직접 설정하지 말 것
    });

    if (response.ok) {
        alert("Patient has been successfully registered.");
        const again = confirm(
            "Would you like to register another patient?\n\n" +
            "OK: Add another\nCancel: Go to list"
        );
        if (again) {
            resetAddPatientPage();
        } else {
            resetAddPatientPage();
            window.location.href = "/app";
        }
    } else {
        const text = await response.text().catch(() => "");
        console.error("Upload failed:", response.status, text);
        alert("등록 중 오류가 발생했습니다.");
    }
}

function resetAddPatientPage() {
    // 1) 환자 기본 정보 초기화
    const typeEl = document.getElementById("add_patient_type");
    if (typeEl) typeEl.value = "new";

    clearPatientFields(); // ID, Name, Gender, Birth, Recent 등 초기화

    const visitEl = document.getElementById("add_patient_visit");
    if (visitEl) {
        visitEl.value = getLocalDateTime(); // 현재 날짜/시간 다시 세팅
    }

    const noteEl = document.getElementById("add-patient-note");
    if (noteEl) {
        noteEl.value = "";
    }

    // 2) nail / psoriasis 데이터 초기화
    nailJson = initNailJson();
    nailPsoriasisJson = initnailPsoriasisJson();

    // psoriasis 체크박스 및 UI 초기화
    const sarCheckbox = document.getElementById("add_imagedata_sar");
    if (sarCheckbox) {
        sarCheckbox.checked = false;
        onChangePsar(sarCheckbox); // .psoriasis-func 다시 숨기기
    }

    // 3) 원본 이미지 영역 초기화
    const originDiv = document.getElementById("select_origin_image");
    if (originDiv) {
        originDiv.innerHTML = "";
    }

    // 4) crop 이미지 영역 초기화 (select_crop_* 셀)
    const selectCropList = ["t_l", "i_l", "m_l", "r_l", "p_l", "t_r", "i_r", "m_r", "r_r", "p_r"];
    selectCropList.forEach((item) => {
        const baseId = "select_crop_" + item;
        const cell = document.getElementById(baseId);
        const dCell = document.getElementById(baseId + "_d");
        const bCell = document.getElementById(baseId + "_b");
        const aiInput = document.getElementById(baseId + "_ai");

        if (cell) cell.innerHTML = "";           // 이미지 지우기
        if (aiInput) aiInput.value = "";         // AI 결과값 초기화

        if (dCell) {
            const buttons = dCell.querySelectorAll("button");
            buttons.forEach((btn) => btn.classList.add("none")); // 확대보기 버튼 숨김
        }
        if (bCell) {
            const buttons = bCell.querySelectorAll("button");
            buttons.forEach((btn) => btn.classList.add("none")); // Left/Right 선택 버튼 숨김
        }
    });

    // 5) 오른쪽 Image Datas 테이블의 이미지/AI/Extra 초기화
    const placeholder = "/static/imgs/add_placeholder.png";
    const imageDataKeys = ["t_l", "i_l", "m_l", "r_l", "p_l", "t_r", "i_r", "m_r", "r_r", "p_r"];

    imageDataKeys.forEach((key) => {
        const baseId = "image_data_" + key;

        // 기본 썸네일 영역
        const thumbTd = document.getElementById(baseId);
        if (thumbTd) {
            let img = thumbTd.querySelector("img");
            if (!img) {
                img = document.createElement("img");
                img.height = 60;
                img.className = "fit-image";
                thumbTd.innerHTML = "";
                thumbTd.appendChild(img);
            }
            img.src = placeholder;
        }

        // Extra 썸네일 영역
        const extraTd = document.getElementById(baseId + "_e");
        if (extraTd) {
            const extraImg = extraTd.querySelector("img");
            if (extraImg) extraImg.src = placeholder;
        }

        // AI 결과 영역
        const aiTd = document.getElementById(baseId + "_ai");
        if (aiTd) {
            aiTd.innerHTML = "";
        }
    });

    // 6) 건선(NAPSI) 테이블 값 초기화
    document.querySelectorAll(".psoriasis_table span").forEach((span) => {
        span.textContent = "0";
        span.removeAttribute("title");
    });

}

const AI_OPTIONS = ["Melanoma", "Normal Nail", "Onychomycosis", "Psoriasis"];

function normalizeAiClass(className) {
    if (!className) return "Normal Nail";
    const map = {
        "Healthy_Nail": "Normal Nail",
        "Acral_Lentiginous_Melanoma": "Melanoma",
        "psoriasis": "Psoriasis"
    };
    return map[className] || className;
}

function renderAiEditableUI(fingerType, containerId, aiData) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const currentClass = normalizeAiClass(aiData?.predicted_class);
    const prob = aiData?.probability || 0;
    const isStandard = AI_OPTIONS.includes(currentClass);

    let html = `<div class="ai-select-container">`;
    html += `<select class="form-control form-control-sm" onchange="onAiClassChange('${fingerType}', '${containerId}', this)">`;
    AI_OPTIONS.forEach(opt => {
        html += `<option value="${opt}" ${currentClass === opt ? 'selected' : ''}>${opt}</option>`;
    });
    html += `<option value="Custom" ${!isStandard ? 'selected' : ''}>Others...</option>`;
    html += `</select>`;

    html += `<input type="text" class="form-control form-control-sm ${isStandard ? 'd-none' : ''}" 
                placeholder="Type here..." 
                value="${isStandard ? '' : currentClass}" 
                oninput="onAiInputUpdate('${fingerType}', this)">`;
    
    html += `<div class="ai-prob-label">[auc : ${(prob * 100).toFixed(2)}%]</div>`;
    html += `</div>`;

    container.innerHTML = html;

    syncNailAiData(fingerType, currentClass, prob);
}

function syncNailAiData(fingerType, predictedClass, probability) {
    const aiObj = {
        predicted_class: predictedClass,
        probability: parseFloat(probability) || 1.0
    };
    nailJson[fingerType].ai = JSON.stringify(aiObj);
}

function onAiClassChange(fingerType, containerId, selectEl) {
    const inputEl = selectEl.nextElementSibling;
    const probLabel = inputEl.nextElementSibling;
    const prob = parseFloat(probLabel.textContent.replace(/[^0-9.]/g, "")) / 100 || 0;

    if (selectEl.value === "Custom") {
        inputEl.classList.remove("d-none");
        syncNailAiData(fingerType, inputEl.value, prob);
    } else {
        inputEl.classList.add("d-none");
        syncNailAiData(fingerType, selectEl.value, prob);
    }
    refreshNapsiColumns();
}

function onAiInputUpdate(fingerType, inputEl) {
    const probLabel = inputEl.nextElementSibling;
    const prob = parseFloat(probLabel.textContent.replace(/[^0-9.]/g, "")) / 100 || 0;
    syncNailAiData(fingerType, inputEl.value, prob);
    refreshNapsiColumns();
}