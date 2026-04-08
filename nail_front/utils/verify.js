// 이메일 검증
export function verifyEmail(asValue) {
    const regExp = /^[0-9a-zA-Z]([-_\.]?[0-9a-zA-Z])*@[0-9a-zA-Z]([-_\.]?[0-9a-zA-Z])*\.[a-zA-Z]{2,3}$/i;
    return regExp.test(asValue);
}

// 비밀번호 검증(8자 이상 영문, 숫자, 특수문자 조합)
export function verifyPassword(asValue) {
    const regExp = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;
	//const regExp = /^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z\d]{8,}$/;
	// const regExp = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[$@$!%*#?&])[A-Za-z\d$@$!%*#?&]{8,}$/;
	return regExp.test(asValue);
}

// 이름 검증(한글 2~4자, 영문 2~10자 이내 : 띄어쓰기(\s)가 들어가며 First, Last Name 형식)
export function verifyName(asValue) {
    const regExp = /^[가-힣]{2,10}|[a-zA-Z]{2,10}\s[a-zA-Z]{2,10}$/;
    return regExp.test(asValue);
}