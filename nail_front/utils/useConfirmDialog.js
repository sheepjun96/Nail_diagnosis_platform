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

    popup.style.padding = "0.95rem";
    popup.style.borderRadius = "9px";

    if (title) {
      title.style.fontSize = "1.1rem";
      title.style.fontWeight = "700";
      title.style.padding = "0";
      title.style.marginBottom = "0.4rem";
    }
    if (htmlContainer) {
      htmlContainer.style.fontSize = "0.875rem";
      htmlContainer.style.lineHeight = "1.45";
      htmlContainer.style.margin = "0";
    }
    if (confirmBtn) {
      confirmBtn.style.fontSize = "0.85rem";
      confirmBtn.style.padding = "8px 14px";
      confirmBtn.style.borderRadius = "7px";
    }
    if (cancelBtn) {
      cancelBtn.style.fontSize = "0.85rem";
      cancelBtn.style.padding = "8px 14px";
      cancelBtn.style.borderRadius = "7px";
    }
    if (actions) {
      actions.style.gap = "0.45rem";
      actions.style.marginTop = "0.8rem";
    }
    if (footer) footer.style.fontSize = "0.8rem";
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
    confirmButtonText,
    cancelButtonText,
    background = "#454545",
    color = "#fff",
    width = "380px",
    isCustom = true,
  }) => {
    const { value } = await Swal.fire({
      title,
      html,
      input,
      inputValue,
      inputAttributes,
      footer,
      showCancelButton: true,
      confirmButtonText: confirmButtonText ?? confirmText,
      cancelButtonText: cancelButtonText ?? cancelText,
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
    confirmButtonText,
    cancelButtonText,
    icon = "question",
    background = "#454545",
    color = "#fff",
    width = "360px",
    isCustom = true,
  }) => {
    const result = await Swal.fire({
      title,
      text,
      html,
      icon,
      showCancelButton: true,
      confirmButtonText: confirmButtonText ?? confirmText,
      cancelButtonText: cancelButtonText ?? cancelText,
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
    confirmButtonText,
    cancelButtonText,
    showCancelButton = false,
    background = "#454545",
    color = "#fff",
    width = "340px",
    isCustom = true,
    ...rest
  }) => {
    return await Swal.fire({
      title,
      text,
      html,
      icon,
      confirmButtonText: confirmButtonText ?? confirmText,
      cancelButtonText: cancelButtonText ?? cancelText,
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
