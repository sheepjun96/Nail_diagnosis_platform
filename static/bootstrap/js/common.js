const NULL_IMG = "/static/imgs/Null.png";

function setFingerImage(imgElement, extraElement, nailJson) {
    if (!imgElement || !extraElement) return;
    
    imgElement.src = NULL_IMG;
    extraElement.textContent = "No extra";
    if (!nailJson) return;

    try {
        const obj = typeof nailJson === "string" ? JSON.parse(nailJson) : nailJson;

        // 1) crop 이미지
        const name = obj.name || "";
        if (name) {
            const safeName = name.split("/").pop();
            imgElement.src =
                `/api/resource/image/dump?filename=${encodeURIComponent(safeName)}&filetype=1`;
        }

        // 2) extra 이미지
        if (obj.extra && obj.extra.length > 0) {
            extraElement.textContent = "";
            const extraImg = document.createElement("img");
            extraImg.src = obj.extra[0];
            extraImg.height = 40;
            extraElement.appendChild(extraImg);
        }
    } catch (e) {
        console.error("nailJson 파싱 에러", e);
        imgElement.src = NULL_IMG;
        extraElement.textContent = "No extra";
    }
}