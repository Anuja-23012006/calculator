/* ==========================================================================
   Calculator — script.js
   ========================================================================== */
(() => {
  'use strict';

  /* ---------- Constants ---------- */
  const OPERATOR_SYMBOLS = { '+': '+', '-': '−', '*': '×', '/': '÷' };
  const MAX_DIGITS = 15;
  const HISTORY_LIMIT = 10;
  const HISTORY_KEY = 'calc-history';
  const THEME_KEY = 'calc-theme';
  const DIV_ZERO_MSG = 'Cannot divide by zero';

  class DivisionByZeroError extends Error {}

  /* ---------- State ---------- */
  const state = {
    tokens: [],
    current: '',
    justEvaluated: false,
    error: '',
    lastExpr: ''
  };

  let history = [];
  let lastMain = null;

  /* ---------- DOM ---------- */
  const expressionEl = document.getElementById('expression');
  const resultEl = document.getElementById('result');
  const keypad = document.querySelector('.keypad');
  const themeToggle = document.getElementById('theme-toggle');

  const historyToggle = document.getElementById('history-toggle');
  const historyPanel = document.getElementById('history-panel');
  const historyOverlay = document.getElementById('history-overlay');
  const closeHistoryBtn = document.getElementById('close-history');
  const historyList = document.getElementById('history-list');
  const historyEmpty = document.getElementById('history-empty');
  const clearHistoryBtn = document.getElementById('clear-history');

  /* ---------- Safe localStorage helpers ---------- */
  const storage = {
    get(key) {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch {
        /* ignore */
      }
    }
  };

  /* ---------- Helpers ---------- */
  const isOperator = (t) => Object.prototype.hasOwnProperty.call(OPERATOR_SYMBOLS, t);

  const prettyNumber = (s) =>
    s.replace(/\.$/, '').replace(/^-/, '−');

  const displayTokens = (list) =>
    list
      .map((t) => (isOperator(t) ? OPERATOR_SYMBOLS[t] : prettyNumber(t)))
      .join(' ');

  function fullTokens() {
    const list = [...state.tokens];

    if (state.current !== '' && state.current !== '-') {
      list.push(state.current);
    }

    if (list.length && isOperator(list[list.length - 1])) {
      list.pop();
    }

    return list;
  }

  function calculate(list) {
    const values = [Number(list[0])];
    const addOps = [];

    for (let i = 1; i < list.length; i += 2) {
      const op = list[i];
      const n = Number(list[i + 1]);

      if (op === '*') {
        values[values.length - 1] *= n;
      } else if (op === '/') {
        if (n === 0) throw new DivisionByZeroError();
        values[values.length - 1] /= n;
      } else {
        addOps.push(op);
        values.push(n);
      }
    }

    let total = values[0];

    addOps.forEach((op, i) => {
      total = op === '+' ? total + values[i + 1] : total - values[i + 1];
    });

    return total;
  }

  function formatResult(n) {
    if (!Number.isFinite(n)) throw new Error('Overflow');
    if (Object.is(n, -0)) n = 0;

    const rounded = Number(n.toPrecision(12));
    const abs = Math.abs(rounded);

    if (abs >= 1e15 || (abs !== 0 && abs < 1e-9)) {
      return rounded.toExponential();
    }

    return String(rounded);
  }

  /* ---------- Input handlers ---------- */
  function reset() {
    state.tokens = [];
    state.current = '';
    state.justEvaluated = false;
    state.error = '';
    state.lastExpr = '';
  }

  function prepareForNewNumber() {
    if (state.error || state.justEvaluated) reset();
  }

  function inputDigit(d) {
    prepareForNewNumber();

    if (state.current.replace(/\D/g, '').length >= MAX_DIGITS) return;

    if (state.current === '0') {
      state.current = d;
    } else if (state.current === '-0') {
      state.current = '-' + d;
    } else {
      state.current += d;
    }
  }

  function inputDecimal() {
    prepareForNewNumber();

    if (state.current.includes('.')) return;

    if (state.current === '' || state.current === '-') {
      state.current += '0.';
    } else {
      state.current += '.';
    }
  }

  function inputOperator(op) {
    if (state.error) reset();

    if (state.justEvaluated) {
      state.justEvaluated = false;
      state.tokens = [];
    }

    if (state.current === '') {
      const last = state.tokens[state.tokens.length - 1];

      if (state.tokens.length === 0) {
        if (op === '-') state.current = '-';
      } else if (isOperator(last)) {
        state.tokens[state.tokens.length - 1] = op;
      }
    } else if (state.current !== '-') {
      state.tokens.push(state.current, op);
      state.current = '';
    }
  }

  function backspace() {
    if (state.error) {
      reset();
      return;
    }

    state.justEvaluated = false;

    if (state.current !== '') {
      state.current = state.current.slice(0, -1);
    } else if (state.tokens.length) {
      state.tokens.pop();
      state.current = state.tokens.pop() ?? '';
    }
  }

  function equals() {
    if (state.error || state.justEvaluated) return;

    const list = fullTokens();
    if (list.length < 3) return;

    const expr = displayTokens(list);

    try {
      const result = formatResult(calculate(list));

      addHistory(expr, result);

      state.lastExpr = expr;
      state.tokens = [];
      state.current = result;
      state.justEvaluated = true;
    } catch (err) {
      state.lastExpr = expr;
      state.tokens = [];
      state.current = '';
      state.error = err instanceof DivisionByZeroError ? DIV_ZERO_MSG : 'Error';
    }
  }

  function handle(action, value) {
    switch (action) {
      case 'digit':
        inputDigit(value);
        break;
      case 'decimal':
        inputDecimal();
        break;
      case 'operator':
        inputOperator(value);
        break;
      case 'equals':
        equals();
        break;
      case 'delete':
        backspace();
        break;
      case 'clear':
        reset();
        break;
      default:
        return;
    }

    render();
  }

  /* ---------- Rendering ---------- */
  function render() {
    let expr = '';
    let main = '0';
    let isError = false;

    if (state.error) {
      expr = state.lastExpr;
      main = state.error;
      isError = true;
    } else if (state.justEvaluated) {
      expr = state.lastExpr + ' =';
      main = prettyNumber(state.current);
    } else {
      const list = fullTokens();
      const typing = state.current.replace(/^-/, '−');

      expr = [displayTokens(state.tokens), typing].filter(Boolean).join(' ');

      if (list.length >= 3) {
        try {
          main = prettyNumber(formatResult(calculate(list)));
        } catch (err) {
          main = err instanceof DivisionByZeroError ? DIV_ZERO_MSG : 'Error';
          isError = true;
        }
      } else if (state.tokens.length === 0) {
        main = typing || '0';
      } else {
        main = prettyNumber(list[0]);
      }
    }

    if (expr.length > 32) {
      expr = '…' + expr.slice(-31);
    }

    expressionEl.textContent = expr;
    resultEl.textContent = main;

    resultEl.classList.toggle('is-error', isError);
    resultEl.classList.toggle('medium', !isError && main.length > 9 && main.length <= 13);
    resultEl.classList.toggle('small', !isError && main.length > 13);

    if (main !== lastMain) {
      resultEl.classList.remove('pop');
      void resultEl.offsetWidth;
      resultEl.classList.add('pop');
      lastMain = main;
    }
  }

  /* ---------- History ---------- */
  function loadHistory() {
    try {
      const parsed = JSON.parse(storage.get(HISTORY_KEY) || '[]');

      if (Array.isArray(parsed)) {
        history = parsed
          .filter((h) => h && typeof h.expr === 'string' && typeof h.result === 'string')
          .slice(0, HISTORY_LIMIT);
      }
    } catch {
      history = [];
    }
  }

  function addHistory(expr, result) {
    history.unshift({ expr, result });
    history = history.slice(0, HISTORY_LIMIT);
    storage.set(HISTORY_KEY, JSON.stringify(history));
    renderHistory();
  }

  function renderHistory() {
    historyList.textContent = '';

    history.forEach((item) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');

      btn.type = 'button';
      btn.className = 'history-item';
      btn.setAttribute(
        'aria-label',
        `${item.expr} equals ${item.result}. Use this result.`
      );

      const e = document.createElement('span');
      e.className = 'h-expr';
      e.textContent = item.expr + ' =';

      const r = document.createElement('span');
      r.className = 'h-res';
      r.textContent = prettyNumber(item.result);

      btn.append(e, r);

      btn.addEventListener('click', () => {
        reset();
        state.current = item.result;
        state.lastExpr = item.expr;
        state.justEvaluated = true;
        render();
        closeHistory();
      });

      li.appendChild(btn);
      historyList.appendChild(li);
    });

    historyEmpty.hidden = history.length > 0;
    clearHistoryBtn.disabled = history.length === 0;
  }

  clearHistoryBtn.addEventListener('click', () => {
    history = [];
    storage.set(HISTORY_KEY, '[]');
    renderHistory();
  });

  /* ---------- History panel ---------- */
  function openHistory() {
    historyOverlay.hidden = false;

    requestAnimationFrame(() => {
      historyOverlay.classList.add('open');
    });

    historyPanel.classList.add('open');
    historyPanel.setAttribute('aria-hidden', 'false');

    historyToggle.setAttribute('aria-expanded', 'true');
    historyToggle.setAttribute('aria-label', 'Close history');
  }

  function closeHistory() {
    historyOverlay.classList.remove('open');
    historyPanel.classList.remove('open');
    historyPanel.setAttribute('aria-hidden', 'true');

    historyToggle.setAttribute('aria-expanded', 'false');
    historyToggle.setAttribute('aria-label', 'Open history');

    setTimeout(() => {
      if (!historyPanel.classList.contains('open')) {
        historyOverlay.hidden = true;
      }
    }, 280);
  }

  historyToggle.addEventListener('click', () => {
    if (historyPanel.classList.contains('open')) {
      closeHistory();
    } else {
      openHistory();
    }
  });

  closeHistoryBtn.addEventListener('click', closeHistory);
  historyOverlay.addEventListener('click', closeHistory);

  /* ---------- Theme ---------- */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);

    themeToggle.setAttribute(
      'aria-label',
      theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
    );

    themeToggle.querySelector('.icon').textContent =
      theme === 'dark' ? '☀️' : '🌙';
  }

  function initTheme() {
    const saved = storage.get(THEME_KEY);
    const prefersDark =
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;

    applyTheme(
      saved === 'dark' || saved === 'light'
        ? saved
        : prefersDark
          ? 'dark'
          : 'light'
    );
  }

  themeToggle.addEventListener('click', () => {
    const next =
      document.documentElement.getAttribute('data-theme') === 'dark'
        ? 'light'
        : 'dark';

    applyTheme(next);
    storage.set(THEME_KEY, next);
  });

  /* ---------- Events ---------- */
  keypad.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (btn) handle(btn.dataset.action, btn.dataset.value);
  });

  const keyMap = new Map();

  keypad.querySelectorAll('button[data-key]').forEach((b) => {
    keyMap.set(b.dataset.key, b);
  });

  const KEY_ALIASES = {
    '=': 'Enter',
    x: '*',
    X: '*',
    Delete: 'Escape',
    ',': '.'
  };

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.key === 'Escape' && historyPanel.classList.contains('open')) {
      closeHistory();
      return;
    }

    const onOtherButton =
      e.target.closest &&
      e.target.closest('button') &&
      !e.target.closest('.keypad');

    if (e.key === 'Enter' && onOtherButton) return;

    const key = KEY_ALIASES[e.key] || e.key;
    const btn = keyMap.get(key);

    if (!btn) return;

    e.preventDefault();

    if (e.repeat && key !== 'Backspace') return;

    btn.classList.add('pressed');
    setTimeout(() => btn.classList.remove('pressed'), 130);
    btn.click();
  });

  /* ---------- Init ---------- */
  initTheme();
  loadHistory();
  renderHistory();
  render();
})();