async function sendPatientData(data) {
    try {
        const response = await fetch("http://127.0.0.1:8000/send_patient_data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });
        const json = await response.json();
        if (json.redirect_url) {
            window.location.href = json.redirect_url;
        } else {
            alert("등록 실패 또는 서버 오류");
        }
    } catch (e) {
        alert("전송 실패: " + e.message);
    }
}