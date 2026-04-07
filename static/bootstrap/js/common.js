const NULL_IMG = "/static/imgs/Null.png";

function getDynamicThumbUrl(rawUrl, element, fallbackWidth = 200) {
    if (!rawUrl || rawUrl === NULL_IMG) return rawUrl;

    let targetWidth = element ? (element.clientWidth || element.offsetWidth) : 0;
    if (targetWidth <= 0) targetWidth = fallbackWidth;

    const url = new URL(rawUrl, window.location.origin);
    url.searchParams.set("width", targetWidth);
    return url.pathname + url.search;
}

function setFingerImage(imgElement, extraElement, nailJson) {
    if (!imgElement || !extraElement) return;

    imgElement.src = NULL_IMG;
    extraElement.textContent = "No extra";

    if (!nailJson) return;

    try {
        const obj = typeof nailJson === "string" ? JSON.parse(nailJson) : nailJson;

        const targetWidth = imgElement.clientWidth || 200;

        // 1) crop 이미지
        const name = obj.name || "";
        if (name) {
            const safeName = name.split("/").pop();
            const rawUrl = `/api/resource/image/dump?filename=${encodeURIComponent(safeName)}&filetype=1`;
            imgElement.src = getDynamicThumbUrl(rawUrl, imgElement, 250);
            imgElement.classList.add("js-detail-image");
        }

        if (obj.extra && obj.extra.length > 0) {
            extraElement.textContent = "";
            const extraImg = document.createElement("img");
            
            imgElement.src = getDynamicThumbUrl(rawUrl, imgElement, 250);
            extraImg.height = 40;
            extraImg.classList.add("js-detail-image");
            extraElement.appendChild(extraImg);
        }
    } catch (e) {
        console.error("nailJson 파싱 에러", e);
    }
}

// 이미지 src 에서 /app/image 로 연결되는 팝업 열기
function openImageDetailByUrl(rawSrc) {
    if (!rawSrc) return;

    const url = new URL(rawSrc, window.location.origin);
    url.searchParams.delete("width");
    const popupUrl = `/app/image${url.search}`;

    window.open(
        popupUrl,
        "_blank",
        "width=900,height=900,menubar=no,toolbar=no,location=no,status=no,scrollbars=yes"
    );
}

// 페이지 전체에 이미지 디테일 뷰 기능 바인딩
function bindGlobalImageDetail() {
    document.addEventListener("click", function (e) {
        const img = e.target.closest("img.js-detail-image");
        if (!img) return;

        e.preventDefault();
        openImageDetailByUrl(img.src);
    });
}

function initGlobalSearch(searchCallback) {
    const input = document.getElementById('main_search_input');
    if (!input) return;

    // 엔터키 입력 시 검색 실행
    input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            searchCallback(1); // 검색 시 1페이지부터 로드
        }
    });
    
    // 돋보기 버튼 클릭 시에도 검색 실행 (버튼 클래스 btn-accent 기준)
    const btn = input.closest('.input-group')?.querySelector('button.btn-accent');
    if (btn) {
        btn.onclick = () => searchCallback(1);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    bindGlobalImageDetail();
});