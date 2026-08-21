.rules-widget {
  position: fixed;
  left: 16px;
  bottom: 16px;
  z-index: 85;
}

.rules-toggle {
  padding: 10px 16px;
  border-radius: 999px;
  border: 1px solid rgba(120, 145, 225, .3);
  background: rgba(8, 13, 30, .92);
  color: white;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: .1em;
  cursor: pointer;
  box-shadow: 0 10px 30px rgba(0, 0, 0, .4);
}

.rules-toggle:hover {
  transform: translateY(-2px);
  border-color: var(--cyan, #16d8ff);
}

.rules-modal {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: grid;
  place-items: center;
  padding: 24px;
}

.rules-modal.hidden {
  display: none !important;
}

.rules-modal-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(1, 2, 8, .78);
  backdrop-filter: blur(4px);
}

.rules-modal-panel {
  position: relative;
  width: min(620px, 100%);
  max-height: 84vh;
  overflow-y: auto;
  padding: 32px;
  border-radius: 22px;
  border: 1px solid rgba(120, 145, 225, .28);
  background: rgba(8, 13, 30, .97);
  box-shadow: 0 30px 90px rgba(0, 0, 0, .55);
  animation: rulesModalIn .25s cubic-bezier(.2, .8, .2, 1);
}

@keyframes rulesModalIn {
  from { opacity: 0; transform: translateY(14px) scale(.98); }
  to { opacity: 1; transform: none; }
}

.rules-close {
  position: absolute;
  top: 18px;
  right: 18px;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1px solid rgba(120, 145, 225, .3);
  background: rgba(255, 255, 255, .04);
  color: white;
  font-size: 15px;
  cursor: pointer;
}

.rules-close:hover {
  background: rgba(255, 255, 255, .1);
}

.rules-title {
  margin: 0 0 4px;
  font-size: 30px;
  letter-spacing: .04em;
  text-shadow: 0 0 24px rgba(115, 92, 255, .4);
}

.rules-subtitle {
  margin: 0 0 24px;
  color: #a5afd0;
  font-size: 13px;
}

.rules-section {
  margin-bottom: 20px;
  padding-bottom: 20px;
  border-bottom: 1px solid rgba(120, 145, 225, .14);
}

.rules-section:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.rules-section h3 {
  margin: 0 0 8px;
  font-size: 15px;
  color: #16d8ff;
  letter-spacing: .03em;
}

.rules-section p {
  margin: 0 0 8px;
  color: #d8ddf0;
  font-size: 13px;
  line-height: 1.6;
}

.rules-section p:last-child {
  margin-bottom: 0;
}

.rules-section strong {
  color: white;
}

.rules-shop-list {
  margin: 0 0 10px;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 8px;
}

.rules-shop-list li {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 10px;
  background: rgba(255, 255, 255, .03);
  border: 1px solid rgba(120, 145, 225, .16);
  font-size: 13px;
  color: #d8ddf0;
}

.rules-shop-list li span {
  font-size: 15px;
}

.rules-shop-list li strong {
  color: #ffc347;
  margin-right: 2px;
}

@media (max-width: 650px) {
  .rules-widget {
    left: 10px;
    bottom: 10px;
  }

  .rules-toggle {
    padding: 9px 13px;
    font-size: 10px;
  }

  .rules-modal-panel {
    padding: 22px;
    max-height: 88vh;
  }

  .rules-title {
    font-size: 24px;
  }
}
