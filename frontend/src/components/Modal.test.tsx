import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Modal } from "./Modal";

describe("Modal", () => {
  describe("Visibility", () => {
    it("renders nothing when isOpen is false", () => {
      const { container } = render(
        <Modal isOpen={false} onClose={() => {}}>
          Test Content
        </Modal>
      );

      expect(container.firstChild).toBeNull();
    });

    it("renders children when isOpen is true", () => {
      render(
        <Modal isOpen={true} onClose={() => {}}>
          Test Content
        </Modal>
      );

      expect(screen.getByText("Test Content")).toBeInTheDocument();
    });

    it("renders title when provided", () => {
      render(
        <Modal isOpen={true} onClose={() => {}} title="Modal Title">
          Test Content
        </Modal>
      );

      expect(screen.getByText("Modal Title")).toBeInTheDocument();
    });

    it("does not render title when not provided", () => {
      const { container } = render(
        <Modal isOpen={true} onClose={() => {}}>
          Test Content
        </Modal>
      );

      const headings = container.querySelectorAll("h2");
      expect(headings.length).toBe(0);
    });
  });

  describe("Close button", () => {
    it("renders close button when isOpen is true", () => {
      render(
        <Modal isOpen={true} onClose={() => {}}>
          Test Content
        </Modal>
      );

      const closeButton = screen.getByLabelText("Close modal");
      expect(closeButton).toBeInTheDocument();
      expect(closeButton.textContent).toBe("×");
    });

    it("calls onClose when close button is clicked", () => {
      const onClose = vi.fn();
      render(
        <Modal isOpen={true} onClose={onClose}>
          Test Content
        </Modal>
      );

      const closeButton = screen.getByLabelText("Close modal");
      fireEvent.click(closeButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("Backdrop", () => {
    it("calls onClose when backdrop is clicked", () => {
      const onClose = vi.fn();
      const { container } = render(
        <Modal isOpen={true} onClose={onClose}>
          <div>Test Content</div>
        </Modal>
      );

      const backdrop = container.querySelector("div");
      fireEvent.click(backdrop!);

      expect(onClose).toHaveBeenCalled();
    });

    it("does not call onClose when modal content is clicked", () => {
      const onClose = vi.fn();
      render(
        <Modal isOpen={true} onClose={onClose}>
          <div data-testid="modal-content">Test Content</div>
        </Modal>
      );

      const content = screen.getByTestId("modal-content");
      fireEvent.click(content);

      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe("Body scroll lock", () => {
    beforeEach(() => {
      document.body.style.overflow = "";
    });

    afterEach(() => {
      document.body.style.overflow = "";
    });

    it("sets body overflow to hidden when opened", () => {
      render(
        <Modal isOpen={true} onClose={() => {}}>
          Test Content
        </Modal>
      );

      expect(document.body.style.overflow).toBe("hidden");
    });

    it("restores body overflow when closed", () => {
      const { rerender } = render(
        <Modal isOpen={true} onClose={() => {}}>
          Test Content
        </Modal>
      );

      expect(document.body.style.overflow).toBe("hidden");

      rerender(
        <Modal isOpen={false} onClose={() => {}}>
          Test Content
        </Modal>
      );

      expect(document.body.style.overflow).toBe("");
    });

    it("restores body overflow on unmount", () => {
      const { unmount } = render(
        <Modal isOpen={true} onClose={() => {}}>
          Test Content
        </Modal>
      );

      expect(document.body.style.overflow).toBe("hidden");

      unmount();

      expect(document.body.style.overflow).toBe("");
    });

    it("handles repeated open/close cycles without leaking scroll lock", () => {
      const { rerender } = render(
        <Modal isOpen={true} onClose={() => {}}>
          Test Content
        </Modal>
      );

      expect(document.body.style.overflow).toBe("hidden");

      rerender(
        <Modal isOpen={false} onClose={() => {}}>
          Test Content
        </Modal>
      );

      expect(document.body.style.overflow).toBe("");

      rerender(
        <Modal isOpen={true} onClose={() => {}}>
          Test Content
        </Modal>
      );

      expect(document.body.style.overflow).toBe("hidden");

      rerender(
        <Modal isOpen={false} onClose={() => {}}>
          Test Content
        </Modal>
      );

      expect(document.body.style.overflow).toBe("");
    });
  });
});
