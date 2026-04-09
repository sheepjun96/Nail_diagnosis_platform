import Swal from "sweetalert2";

const useConfirmDialog = () => {
  // 공통 커스텀 스타일 적용 함수
  const applyCustomStyles = (popup) => {
    const title = popup.querySelector(".swal2-title");
    const htmlContainer = popup.querySelector(".swal2-html-container");
    const confirmBtn = popup.querySelector(".swal2-confirm");
    const cancelBtn = popup.querySelector(".swal2-cancel");
    const footer = popup.querySelector(".swal2-footer");
    const actions = popup.querySelector(".swal2-actions");

    popup.style.padding = "1.1rem";
    popup.style.borderRadius = "10px";

    if (title) {
      title.style.fontSize = "1.25rem";
      title.style.fontWeight = "700";
      title.style.padding = "0";
      title.style.marginBottom = "0.5rem";
    }
    if (htmlContainer) {
      htmlContainer.style.fontSize = "0.95rem";
      htmlContainer.style.lineHeight = "1.5";
      htmlContainer.style.margin = "0";
    }
    if (confirmBtn) {
      confirmBtn.style.fontSize = "0.9rem";
      confirmBtn.style.padding = "9px 18px";
      confirmBtn.style.borderRadius = "8px";
    }
    if (cancelBtn) {
      cancelBtn.style.fontSize = "0.9rem";
      cancelBtn.style.padding = "9px 18px";
      cancelBtn.style.borderRadius = "8px";
    }
    if (actions) {
      actions.style.gap = "0.5rem";
      actions.style.marginTop = "1rem";
    }
    if (footer) footer.style.fontSize = "0.85rem";
  };

  // 🚩 1. 입력창 전용 함수 추가
  const showInput = async ({
    title,
    html,
    input = "text",
    inputValue = "",
    inputAttributes = {},
    footer = "",
    confirmText = "확인",
    cancelText = "취소",
    background = "#454545",
    color = "#fff",
    width = "420px",
    isCustom = false,
  }) => {
    const { value } = await Swal.fire({
      title,
      html,
      input,
      inputValue,
      inputAttributes,
      footer,
      showCancelButton: true,
      confirmButtonText: confirmText,
      cancelButtonText: cancelText,
      background,
      color,
      width,
      didOpen: (popup) => {
        if (isCustom) applyCustomStyles(popup);
      },
    });
    return value; // 입력된 값 또는 undefined 반환
  };

  const showConfirm = async ({
    title,
    text,
    html,
    confirmText = "확인",
    cancelText = "취소",
    icon = "question",
    background = "#454545",
    color = "#fff",
    width,
    isCustom = false,
  }) => {
    const result = await Swal.fire({
      title,
      text,
      html,
      icon,
      showCancelButton: true,
      confirmButtonText: confirmText,
      cancelButtonText: cancelText,
      background,
      color,
      width,
      didOpen: (popup) => {
        if (isCustom) applyCustomStyles(popup);
      },
    });
    return result.isConfirmed;
  };

  const showAlert = async ({
    title,
    text,
    html,
    icon = "warning",
    confirmText = "확인",
    cancelText = "취소",
    showCancelButton = false,
    background = "#454545",
    color = "#fff",
    width,
    isCustom = false,
    ...rest
  }) => {
    return await Swal.fire({
      title,
      text,
      html,
      icon,
      confirmButtonText: confirmText,
      cancelButtonText: cancelText,
      showCancelButton,
      background,
      color,
      width,
      didOpen: (popup) => {
        if (isCustom) applyCustomStyles(popup);
      },
      ...rest,
    });
  };

  return { showConfirm, showAlert, showInput };
};

export default useConfirmDialog;
