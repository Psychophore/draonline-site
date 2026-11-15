(() => {
  'use strict';

  const DATA_BASE = 'data/';
  const jsonCache = new Map();
  let scheduleRequest;
  const MEETING_FORMATS = new Map([
    ['online', 'Онлайн'],
    ['offline', 'Очно'],
    ['hybrid', 'Гибрид']
  ]);

  const MONTH_NAMES = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ];

  const WEB_URL_PATTERN = /^https?:\/\//i;
  const CONTACT_URL_PATTERN = /^(?:mailto:|tel:)[^\s<>]*$/i;
  const BLOCKED_PROTOCOLS = /^[a-z][a-z0-9+.-]*:/i;
  const INTERNAL_FILE_PATTERN = /^(?:\.\/|\/)?[\w./#?=&%+,:;@()\-А-Яа-яёЁ]+$/u;
  const DEFAULT_PAGE = 'index.html';

  const SELECTORS = {
    navigation: '[data-navigation]',
    brandText: '[data-brand-text]',
    footerBrand: '[data-footer-brand]',
    socialLinks: '[data-social-links]',
    disclaimer: '[data-disclaimer]',
    homeAnnouncement: '[data-home-announcement]',
    homeContent: '[data-home-content]',
    homeSchedule: '[data-home-schedule]',
    pageContent: '[data-page-content]',
    schedule: '[data-schedule]',
    groupsOverview: '[data-groups-overview]',
    groupPage: '[data-group-page]',
    groupNews: '[data-group-news]',
    stepsList: '[data-steps-list]',
    materialsList: '[data-materials-list]',
    speakerRecordings: '[data-speaker-recordings]',
    dailyCurrent: '[data-daily-current]',
    contactLinks: '[data-contact-links]'
  };

  async function loadJson(file, options) {
    if (jsonCache.has(file)) return jsonCache.get(file);

    const response = await fetch(DATA_BASE + file, options);
    if (!response.ok) throw new Error(`Не удалось загрузить ${file}`);

    const data = await response.json();
    jsonCache.set(file, data);
    return data;
  }

  function appendChild(node, child) {
    if (child === null || child === undefined || child === false) return;
    if (Array.isArray(child)) {
      child.forEach(item => appendChild(node, item));
      return;
    }
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);

    Object.entries(attrs || {}).forEach(([key, value]) => {
      if (value === null || value === undefined || value === false) return;
      if (key === 'class') node.className = value;
      else if (value === true) node.setAttribute(key, key);
      else node.setAttribute(key, value);
    });

    appendChild(node, children);
    return node;
  }

  function clear(node) {
    if (node) node.replaceChildren();
  }

  function text(value, fallback = '') {
    return value === null || value === undefined || value === '' ? fallback : String(value);
  }

  function list(value) {
    return Array.isArray(value) ? value : [];
  }

  function isProtocolRelative(value) {
    return String(value || '').trim().startsWith('//');
  }

  function isSafeUrl(url = '') {
    const value = String(url).trim();
    if (!value || isProtocolRelative(value)) return false;
    if (WEB_URL_PATTERN.test(value) || CONTACT_URL_PATTERN.test(value)) return true;
    if (BLOCKED_PROTOCOLS.test(value)) return false;
    return value.startsWith('#') || INTERNAL_FILE_PATTERN.test(value);
  }

  function isExternalUrl(url = '') {
    return WEB_URL_PATTERN.test(String(url).trim());
  }

  function linkAttrs(url = '', attrs = {}) {
    const href = String(url || '').trim();
    if (!isSafeUrl(href)) return null;
    return {
      ...attrs,
      href,
      ...(isExternalUrl(href) ? { target: '_blank', rel: 'noopener' } : {})
    };
  }

  function mediaAttrs(src = '', attrs = {}) {
    const value = String(src || '').trim();
    if (!isSafeUrl(value)) return null;
    return { ...attrs, src: value };
  }

  function appendError(holder, message) {
    if (!holder) return;
    clear(holder);
    const tag = ['OL', 'UL'].includes(holder.tagName) ? 'li' : 'div';
    holder.append(el(tag, { class: 'empty-state', role: 'alert' }, [message]));
  }

  function appendErrorForAll(holders, message) {
    holders.forEach(holder => appendError(holder, message));
  }

  function currentPageName() {
    const declared = document.body.dataset.currentPage;
    const fromPath = location.pathname.split('/').pop();
    return declared || fromPath || DEFAULT_PAGE;
  }

  function pageFromUrl(url = '') {
    const value = String(url || '').trim();
    if (!value || value.startsWith('#') || !isSafeUrl(value) || isExternalUrl(value) || CONTACT_URL_PATTERN.test(value)) return '';
    const clean = value.split('#')[0].split('?')[0].replace(/^\.\//, '').replace(/^\//, '');
    return clean || DEFAULT_PAGE;
  }

  function setActiveNav() {
    const current = currentPageName();

    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('is-active'));
    document.querySelectorAll('.nav-link, .nav-sublink').forEach(link => {
      link.classList.remove('is-active');
      link.removeAttribute('aria-current');

      if (pageFromUrl(link.getAttribute('href')) !== current) return;

      link.classList.add('is-active');
      link.setAttribute('aria-current', 'page');
      link.closest('.nav-item')?.classList.add('is-active');
    });
  }

  function navigationLink(item, className) {
    const attrs = linkAttrs(item.url || '#', { class: className });
    if (!attrs || !item.label) return null;
    return el('a', attrs, [item.label]);
  }

  function navigationItem(item) {
    if (!item || !item.label) return null;

    const children = list(item.children).filter(child => child && child.label && child.url);
    const wrapper = el('div', { class: `nav-item${children.length ? ' has-children' : ''}` });
    const link = navigationLink(item, 'nav-link');

    if (link) {
      if (children.length) link.setAttribute('aria-haspopup', 'true');
      wrapper.append(link);
    }

    if (children.length) {
      const submenu = el('div', {
        class: 'nav-submenu',
        role: 'group',
        'aria-label': `Подразделы: ${text(item.label, 'Меню')}`
      });

      children.forEach(child => {
        const childLink = navigationLink(child, 'nav-sublink');
        if (childLink) submenu.append(childLink);
      });

      if (submenu.childElementCount) wrapper.append(submenu);
    }

    return wrapper.childElementCount ? wrapper : null;
  }

  async function renderNavigation() {
    const nav = document.querySelector(SELECTORS.navigation);
    if (!nav) return;

    try {
      const items = list(await loadJson('navigation.json'));
      if (!items.length) return;

      clear(nav);
      items.forEach(item => {
        const node = navigationItem(item);
        if (node) nav.append(node);
      });
    } catch (error) {
      console.warn(error);
      appendError(nav, 'Не удалось загрузить меню.');
    } finally {
      setActiveNav();
    }
  }

  function initMenu() {
    const button = document.querySelector('.menu-toggle');
    const nav = document.querySelector(SELECTORS.navigation);
    if (!button || !nav) return;

    button.addEventListener('click', () => {
      const isOpen = nav.classList.toggle('is-open');
      button.setAttribute('aria-expanded', String(isOpen));
    });

    nav.addEventListener('click', event => {
      if (!event.target.closest('a')) return;
      nav.classList.remove('is-open');
      button.setAttribute('aria-expanded', 'false');
    });
  }

  function socialItems(site) {
    const links = site.socialLinks || {};
    return [
      { label: 'Telegram', url: links.telegram },
      { label: 'VK', url: links.vk },
      { label: 'MAX', url: links.max },
      { label: 'Email', url: links.email ? `mailto:${links.email}` : '', display: links.email }
    ].filter(item => item.url && isSafeUrl(item.url));
  }

  function renderBrand(site) {
    document.querySelectorAll(SELECTORS.brandText).forEach(holder => {
      clear(holder);
      holder.append(el('strong', {}, [text(site.siteName, 'DRA')]));
      holder.append(el('small', {}, [text(site.subtitle, 'Dual Recovery Anonymous')]));
    });

    document.querySelectorAll(SELECTORS.footerBrand).forEach(holder => {
      clear(holder);
      holder.append(
        el('strong', {}, [text(site.siteName, 'DRA')]),
        el('br'),
        el('span', {}, [text(site.subtitle, 'DUAL RECOVERY ANONYMOUS')]),
        el('br'),
        el('span', {}, [text(site.description, 'Зависимые в двойном выздоровлении')])
      );
    });
  }

  function renderFooterLinks(site) {
    document.querySelectorAll(SELECTORS.socialLinks).forEach(holder => {
      clear(holder);
      socialItems(site).forEach(item => {
        const attrs = linkAttrs(item.url);
        if (attrs) holder.append(el('a', attrs, [item.label]));
      });
    });
  }

  function renderDisclaimer(site) {
    document.querySelectorAll(SELECTORS.disclaimer).forEach(holder => {
      if (!site.disclaimer) {
        holder.remove();
        return;
      }

      clear(holder);
      holder.append(el('h2', {}, ['Важное уточнение']));
      holder.append(el('p', {}, [site.disclaimer]));
    });
  }

  async function renderSiteChrome() {
    const needsSite = document.querySelector([
      SELECTORS.brandText,
      SELECTORS.footerBrand,
      SELECTORS.socialLinks,
      SELECTORS.disclaimer,
      SELECTORS.contactLinks
    ].join(','));
    if (!needsSite) return;

    try {
      const site = await loadJson('site.json');
      renderBrand(site);
      renderFooterLinks(site);
      renderDisclaimer(site);
    } catch (error) {
      console.warn(error);
      appendErrorForAll(document.querySelectorAll(SELECTORS.socialLinks), 'Не удалось загрузить контакты.');
    }
  }

  function formatClass(format) {
    const value = text(format, 'online').toLowerCase();
    return MEETING_FORMATS.has(value) ? `format-${value}` : '';
  }

  function meetingFormat(item) {
    return MEETING_FORMATS.get(item.format) || text(item.formatLabel || item.format, 'Формат не указан');
  }

  function scheduleCard(item) {
    const hasPhysicalLocation = ['offline', 'hybrid'].includes(item.format) && item.address;
    const address = hasPhysicalLocation ? [item.address, item.room].filter(Boolean).join(', ') : '';
    const mapQuery = address ? encodeURIComponent(item.mapQuery || item.address) : '';
    const mapLink = mapQuery ? linkAttrs(`https://yandex.ru/maps/?text=${mapQuery}&z=16`) : null;

    return el('article', { class: 'meeting-card' }, [
      el('div', { class: 'meeting-time' }, [text(item.time, '—')]),
      el('div', {}, [
        el('h3', {}, [text(item.title, 'Собрание')]),
        el('div', { class: 'badges' }, [
          el('span', { class: 'badge' }, [text(item.groupName || item.groupId, 'DRA')]),
          el('span', { class: `badge ${formatClass(item.format)}`.trim() }, [meetingFormat(item)])
        ]),
        address ? el('p', {}, [el('strong', {}, ['Адрес: ']), address]) : null,
        mapLink ? el('p', {}, [el('a', mapLink, ['Открыть в Яндекс Картах'])]) : null,
        item.note ? el('p', {}, [item.note]) : null
      ])
    ]);
  }

  function sortSchedule(items) {
    return list(items).sort((a, b) => {
      const weekdayDiff = Number(a.weekday || 99) - Number(b.weekday || 99);
      if (weekdayDiff) return weekdayDiff;
      return text(a.time).localeCompare(text(b.time), 'ru');
    });
  }

  function loadSchedule() {
    if (!scheduleRequest) {
      scheduleRequest = loadJson('schedule.json', { cache: 'no-cache' }).then(sortSchedule).catch(error => {
        scheduleRequest = undefined;
        throw error;
      });
    }
    return scheduleRequest;
  }

  function groupScheduleByDay(items) {
    return list(items).reduce((acc, item) => {
      const key = `${Number(item.weekday || 99)}-${text(item.day, 'Без дня')}`;
      if (!acc.has(key)) acc.set(key, []);
      acc.get(key).push(item);
      return acc;
    }, new Map());
  }

  function scheduleList(items, emptyText = 'Расписание для этого раздела пока не заполнено.') {
    if (!items.length) return el('div', { class: 'empty-state' }, [emptyText]);

    const node = el('div', { class: 'schedule-list' });
    groupScheduleByDay(items).forEach((dayItems, key) => {
      const day = key.split('-').slice(1).join('-');
      const group = el('section', { class: 'day-group' }, [
        el('h3', { class: 'day-title' }, [day])
      ]);
      dayItems.forEach(item => group.append(scheduleCard(item)));
      node.append(group);
    });
    return node;
  }

  async function renderSchedules() {
    const holders = document.querySelectorAll(SELECTORS.schedule);
    const home = document.querySelector(SELECTORS.homeSchedule);
    if (!holders.length && !home) return;

    try {
      const schedule = await loadSchedule();

      holders.forEach(holder => {
        const filter = holder.dataset.schedule;
        const items = filter === 'all' ? schedule : schedule.filter(item => item.groupId === filter);
        clear(holder);
        holder.append(scheduleList(items));
      });

      if (home) {
        clear(home);
        home.append(el('h2', {}, ['Собрания']));
        home.append(scheduleList(schedule));
      }
    } catch (error) {
      console.warn(error);
      appendErrorForAll(holders, 'Не удалось загрузить расписание.');
      appendError(home, 'Не удалось загрузить расписание.');
    }
  }

  function groupAction(url, label, primary = false) {
    const attrs = linkAttrs(url, { class: primary ? 'button small primary' : 'button small' });
    return attrs ? el('a', attrs, [label]) : null;
  }

  function groupCard(group, meetings, mode) {
    const image = group.logo ? mediaAttrs(group.logo, { alt: `Логотип группы ${text(group.name, 'DRA')}` }) : null;
    const meetingTimes = meetings.map(item => el('li', {}, [
      `${text(item.day, 'Без дня')}, ${text(item.time, '—')} · ${meetingFormat(item)}`
    ]));
    const actions = mode === 'full'
      ? [
        groupAction(group.slug, 'О группе', true),
        groupAction(`${group.slug || ''}#schedule`, 'Расписание'),
        groupAction(`${group.slug || ''}#news`, 'Новости')
      ].filter(Boolean)
      : [groupAction(group.slug, 'О группе', true)].filter(Boolean);

    return el('article', { class: 'group-card' }, [
      image ? el('img', image) : null,
      el('h3', {}, [text(group.name, 'Группа')]),
      group.shortDescription ? el('p', {}, [group.shortDescription]) : null,
      meetingTimes.length ? el('ul', { class: 'group-meetings', 'aria-label': 'Расписание' }, meetingTimes) : null,
      actions.length ? el('div', { class: 'card-actions' }, actions) : null
    ]);
  }

  function renderGroupNews(holder, group) {
    clear(holder);

    list(group?.news)
      .filter(item => item && (item.title || item.text))
      .sort((a, b) => text(b.date).localeCompare(text(a.date)))
      .forEach(item => {
        const link = item.url ? linkAttrs(item.url, { class: 'button small' }) : null;
        holder.append(el('article', { class: 'news-card' }, [
          item.date ? el('p', { class: 'eyebrow' }, [item.date]) : null,
          el('h3', {}, [text(item.title, 'Объявление')]),
          item.text ? el('p', {}, [item.text]) : null,
          link ? el('p', {}, [el('a', link, [text(item.urlLabel, 'Открыть')])]) : null
        ]));
      });

    if (!holder.childElementCount) {
      holder.append(el('div', { class: 'empty-state' }, ['Новостей и объявлений для этой группы пока нет.']));
    }
  }

  async function renderGroups() {
    const overview = document.querySelector(SELECTORS.groupsOverview);
    const page = document.querySelector(SELECTORS.groupPage);
    const newsHolders = document.querySelectorAll(SELECTORS.groupNews);
    if (!overview && !page && !newsHolders.length) return;

    try {
      const [groupData, schedule] = await Promise.all([
        loadJson('groups.json'),
        overview ? loadSchedule().catch(() => null) : null
      ]);
      const groups = list(groupData);

      if (overview) {
        clear(overview);
        const mode = overview.dataset.groupsOverview || '';
        groups.forEach(group => {
          const meetings = list(schedule).filter(item => item.groupId === group.id);
          overview.append(groupCard(group, meetings, mode));
        });
        if (!schedule) overview.append(el('div', { class: 'empty-state', role: 'alert' }, ['Не удалось загрузить расписание.']));
      }

      if (page) {
        const group = groups.find(item => item.id === page.dataset.groupPage);
        if (!group) {
          appendError(page, 'Информация о группе пока не заполнена.');
          return;
        }

        const image = group.logo ? mediaAttrs(group.logo, { alt: `Логотип группы ${text(group.name, 'DRA')}` }) : null;
        clear(page);
        page.append(el('div', { class: 'group-page-header' }, [
          image ? el('img', image) : null,
          el('div', {}, [
            el('p', { class: 'eyebrow' }, ['Группа DRA']),
            el('h1', {}, [text(group.name, 'Группа')]),
            group.lead ? el('p', { class: 'lead' }, [group.lead]) : null
          ])
        ]));

        if (list(group.notes).length) {
          page.append(el('ul', { class: 'group-notes' }, group.notes.map(note => el('li', {}, [note]))));
        }
      }

      newsHolders.forEach(holder => {
        const group = groups.find(item => item.id === holder.dataset.groupNews);
        renderGroupNews(holder, group);
      });
    } catch (error) {
      console.warn(error);
      appendError(overview, 'Не удалось загрузить информацию о группах.');
      appendError(page, 'Не удалось загрузить информацию о группе.');
      newsHolders.forEach(holder => appendError(holder, 'Не удалось загрузить новости группы.'));
    }
  }

  async function renderSteps() {
    const holder = document.querySelector(SELECTORS.stepsList);
    if (!holder) return;

    try {
      const steps = list(await loadJson('steps.json'));
      clear(holder);
      steps.forEach(step => {
        const value = typeof step === 'string' ? step : step.text;
        if (value) holder.append(el('li', {}, [value]));
      });
    } catch (error) {
      console.warn(error);
      appendError(holder, 'Не удалось загрузить 12 шагов.');
    }
  }

  function materialTypeLabel(type) {
    return {
      daily: 'Ежедневник',
      link: 'Ссылка',
      pdf: 'PDF',
      text: 'Текст'
    }[type] || text(type, 'Материал');
  }

  async function renderMaterials() {
    const holder = document.querySelector(SELECTORS.materialsList);
    if (!holder) return;

    try {
      const materials = list(await loadJson('materials.json'));
      clear(holder);

      if (!materials.length) {
        holder.append(el('div', { class: 'empty-state' }, ['Материалы пока готовятся.']));
        return;
      }

      materials.forEach(item => {
        const actions = [];
        const openAttrs = linkAttrs(item.url, { class: 'button small' });
        const downloadAttrs = linkAttrs(item.downloadUrl, { class: 'button small', download: true });

        if (openAttrs) actions.push(el('a', openAttrs, [item.type === 'pdf' ? 'Открыть PDF' : 'Открыть']));
        if (downloadAttrs) actions.push(el('a', downloadAttrs, ['Скачать']));

        holder.append(el('article', { class: 'material-card' }, [
          el('div', { class: 'type' }, [materialTypeLabel(item.type)]),
          el('h3', {}, [text(item.title, 'Материал')]),
          item.description ? el('p', {}, [item.description]) : null,
          actions.length ? el('div', { class: 'material-actions' }, actions) : null
        ]));
      });
    } catch (error) {
      console.warn(error);
      appendError(holder, 'Не удалось загрузить материалы.');
    }
  }

  async function renderSpeakers() {
    const holder = document.querySelector(SELECTORS.speakerRecordings);
    if (!holder) return;

    try {
      const recordings = list(await loadJson('speaker-recordings.json'));
      clear(holder);

      if (!recordings.length) {
        holder.append(el('div', { class: 'empty-state' }, ['Спикерские записи пока готовятся. Когда они появятся, мы добавим их в этот раздел.']));
        return;
      }

      recordings.forEach(item => {
        const audioSrc = item.audioFile || item.audioUrl;
        const downloadSrc = item.downloadFile || item.downloadUrl || audioSrc;
        const audioAttrs = audioSrc ? mediaAttrs(audioSrc, { type: item.fileType || 'audio/mpeg' }) : null;
        const downloadAttrs = linkAttrs(downloadSrc, { class: 'button small', download: true });
        const details = [item.date, item.speaker, item.duration].filter(Boolean).join(' · ');

        holder.append(el('article', { class: 'speaker-card' }, [
          el('h3', {}, [text(item.title, 'Спикерская запись')]),
          details ? el('p', {}, [details]) : null,
          item.topic ? el('p', {}, [el('strong', {}, ['Тема: ']), item.topic]) : null,
          item.group ? el('p', {}, [el('strong', {}, ['Группа: ']), item.group]) : null,
          audioAttrs ? el('audio', { controls: true, preload: 'none' }, [
            el('source', audioAttrs),
            'Ваш браузер не поддерживает встроенный аудиоплеер.'
          ]) : null,
          downloadAttrs ? el('p', {}, [el('a', downloadAttrs, ['Скачать'])]) : null
        ]));
      });
    } catch (error) {
      console.warn(error);
      appendError(holder, 'Не удалось загрузить спикерские записи.');
    }
  }

  function pad2(value) {
    return String(value).padStart(2, '0');
  }

  function mmdd(month, day) {
    return `${pad2(month)}-${pad2(day)}`;
  }

  function daysInMonth(month) {
    return new Date(2024, month, 0).getDate();
  }

  function isValidMonthDay(month, day) {
    return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(month);
  }

  function isMMDD(value) {
    if (!/^\d{2}-\d{2}$/.test(value || '')) return false;
    const [month, day] = value.split('-').map(Number);
    return isValidMonthDay(month, day);
  }

  function dailyEntryDate(entry = {}) {
    if (isMMDD(entry.date)) return entry.date;

    const month = Number(entry.month);
    const day = Number(entry.day);
    return isValidMonthDay(month, day) ? mmdd(month, day) : '';
  }

  function getTodayMMDD() {
    const now = new Date();
    return mmdd(now.getMonth() + 1, now.getDate());
  }

  function shiftDate(date, delta) {
    const [month, day] = date.split('-').map(Number);
    const jsDate = new Date(2024, month - 1, day);
    jsDate.setDate(jsDate.getDate() + delta);
    return mmdd(jsDate.getMonth() + 1, jsDate.getDate());
  }

  async function renderDaily() {
    const currentHolder = document.querySelector(SELECTORS.dailyCurrent);
    if (!currentHolder) return;

    try {
      const entries = list(await loadJson('daily-reflections.json'));
      const byDate = new Map(
        entries
          .map(item => [dailyEntryDate(item), item])
          .filter(([date]) => date)
      );
      const params = new URLSearchParams(location.search);
      let selected = isMMDD(params.get('date')) ? params.get('date') : getTodayMMDD();
      let selectedMonth = Number(selected.slice(0, 2));
      const monthSelect = document.querySelector('[data-daily-month]');
      const calendar = document.querySelector('[data-daily-calendar]');

      function renderCurrent() {
        const entry = byDate.get(selected);
        clear(currentHolder);
        currentHolder.append(el('p', { class: 'eyebrow' }, [selected.split('-').reverse().join('.')]));

        if (!entry) {
          currentHolder.append(el('h2', {}, ['Материал для этой даты скоро появится.']));
          currentHolder.append(el('p', {}, ['Эта дата пока не заполнена. Попробуйте выбрать другой день в календаре.']));
          return;
        }

        currentHolder.append(el('h2', {}, [text(entry.title, 'Ежедневное размышление')]));
        if (entry.quote) currentHolder.append(el('blockquote', {}, [entry.quote]));
        list(entry.body).forEach(paragraph => currentHolder.append(el('p', {}, [paragraph])));
        if (entry.source) currentHolder.append(el('p', {}, [el('small', {}, [entry.source])]));
      }

      function renderCalendar() {
        if (!calendar) return;
        clear(calendar);

        for (let day = 1; day <= daysInMonth(selectedMonth); day += 1) {
          const date = mmdd(selectedMonth, day);
          const hasEntry = byDate.has(date);
          const button = el('button', {
            type: 'button',
            class: `calendar-day${hasEntry ? ' has-entry' : ''}${date === selected ? ' is-current' : ''}`,
            disabled: hasEntry ? null : true,
            'aria-label': `${day}.${pad2(selectedMonth)}`
          }, [day]);

          if (hasEntry) button.addEventListener('click', () => selectDate(date));
          calendar.append(button);
        }
      }

      function selectDate(date, push = true) {
        selected = isMMDD(date) ? date : getTodayMMDD();
        selectedMonth = Number(selected.slice(0, 2));
        if (push) history.replaceState(null, '', `daily-reflections.html?date=${selected}`);
        renderCurrent();
        renderCalendar();
        if (monthSelect) monthSelect.value = String(selectedMonth);
      }

      if (monthSelect) {
        clear(monthSelect);
        MONTH_NAMES.forEach((name, index) => {
          monthSelect.append(el('option', { value: String(index + 1) }, [name]));
        });
        monthSelect.addEventListener('change', () => {
          selectedMonth = Number(monthSelect.value);
          renderCalendar();
        });
      }

      document.querySelector('[data-daily-prev]')?.addEventListener('click', () => selectDate(shiftDate(selected, -1)));
      document.querySelector('[data-daily-next]')?.addEventListener('click', () => selectDate(shiftDate(selected, 1)));
      document.querySelector('[data-daily-today]')?.addEventListener('click', () => selectDate(getTodayMMDD()));
      selectDate(selected, false);
    } catch (error) {
      console.warn(error);
      appendError(currentHolder, 'Не удалось загрузить ежедневные размышления.');
    }
  }

  async function renderContacts() {
    const holder = document.querySelector(SELECTORS.contactLinks);
    if (!holder) return;

    try {
      const site = await loadJson('site.json');
      clear(holder);
      socialItems(site).forEach(item => {
        const attrs = linkAttrs(item.url);
        if (!attrs) return;
        holder.append(el('article', { class: 'contact-card' }, [
          el('h3', {}, [item.label]),
          el('p', {}, [el('a', attrs, [item.display || item.url])])
        ]));
      });
    } catch (error) {
      console.warn(error);
      appendError(holder, 'Не удалось загрузить контакты.');
    }
  }

  function pageHero(holder, data) {
    const eyebrow = holder.querySelector('.eyebrow')?.textContent || '';
    clear(holder);
    if (eyebrow) holder.append(el('p', { class: 'eyebrow' }, [eyebrow]));
    holder.append(el('h1', {}, [text(data.heading || data.title, 'DRA')]));
    if (data.lead) holder.append(el('p', { class: 'lead' }, [data.lead]));
  }

  async function renderHomeContent() {
    const holder = document.querySelector(SELECTORS.homeContent);
    if (!holder) return;

    try {
      const pages = await loadJson('pages.json');
      const data = pages.home;
      if (!data) return;

      const announcement = document.querySelector(SELECTORS.homeAnnouncement);
      const announcementText = text(data.announcement?.text).trim();
      if (announcement && data.announcement?.enabled === true && announcementText) {
        announcement.append(el('p', {}, [announcementText]));
        announcement.hidden = false;
      }

      const logo = holder.querySelector('.hero-logo');
      clear(holder);

      const identity = el('div', { class: 'hero-identity' });
      if (logo) identity.append(logo);
      if (data.subtitle) identity.append(el('p', { class: 'eyebrow' }, [data.subtitle]));
      if (identity.childElementCount) holder.append(identity);

      holder.append(el('h1', {}, [text(data.heading || data.title, 'DRA')]));
      if (data.lead) holder.append(el('p', { class: 'lead' }, [data.lead]));
      if (data.slogan) holder.append(el('p', { class: 'slogan' }, [data.slogan]));

      if (list(data.primaryButtons).length) {
        const buttons = el('div', { class: 'button-row' });
        data.primaryButtons.forEach((button, index) => {
          const attrs = linkAttrs(button.url, { class: index === 0 ? 'button primary' : 'button' });
          if (attrs && button.label) buttons.append(el('a', attrs, [button.label]));
        });
        if (buttons.childElementCount) holder.append(buttons);
      }
    } catch (error) {
      console.warn(error);
    }
  }

  async function renderPageContent() {
    const holders = document.querySelectorAll(SELECTORS.pageContent);
    if (!holders.length) return;

    try {
      const pages = await loadJson('pages.json');
      holders.forEach(holder => {
        const data = pages[holder.dataset.pageContent];
        if (!data) return;

        pageHero(holder, data);
        list(data.sections).forEach(section => {
          if (section.heading) holder.append(el('h2', {}, [section.heading]));
          list(section.paragraphs).forEach(paragraph => holder.append(el('p', {}, [paragraph])));
        });
      });
    } catch (error) {
      console.warn(error);
      appendErrorForAll(holders, 'Не удалось загрузить текст страницы.');
    }
  }

  function renderAll() {
    initMenu();
    setActiveNav();
    renderNavigation();
    renderSiteChrome();
    renderHomeContent();
    renderPageContent();
    renderSchedules();
    renderGroups();
    renderSteps();
    renderMaterials();
    renderSpeakers();
    renderDaily();
    renderContacts();
  }

  window.addEventListener('DOMContentLoaded', renderAll);
})();
