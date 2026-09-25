import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Calendar,
  RotateCcw,
  X,
  ChevronUp,
  ChevronDown
} from 'lucide-react';

import {
  dateRangeError,
  emptyAuditFilters,
  parseFilterDate,
  periodRange
} from './auditFilters.js';

import './AuditFilters.css';


const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec'
];

const pad = (n) => String(n).padStart(2, '0');


export function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}


function toParts(ddmmyyyy, fallbackDate) {
  const iso = parseFilterDate(ddmmyyyy);

  if (iso) {
    const [year, month, day] = iso.split('-').map(Number);

    return {
      day,
      month,
      year
    };
  }

  return {
    day: fallbackDate.getDate(),
    month: fallbackDate.getMonth() + 1,
    year: fallbackDate.getFullYear()
  };
}


function toIso({ day, month, year }) {
  return `${year}-${pad(month)}-${pad(day)}`;
}


function toDisplay({ day, month, year }) {
  return `${pad(day)}-${pad(month)}-${year}`;
}


function toReadable({ day, month, year }) {
  return `${pad(day)} ${MONTHS[month - 1]} ${year}`;
}


function fromIso(iso) {
  const [year, month, day] = iso.split('-').map(Number);

  return {
    day,
    month,
    year
  };
}


function deriveYearBounds(records = [], now = new Date()) {
  const currentYear = now.getFullYear();

  const years = [
    currentYear - 2,
    currentYear - 1,
    currentYear
  ];

  for (const row of records) {
    if (!row) continue;

    for (const raw of [
      row.timestamp,
      row.id,
      row.caseNumber,
      row.orderId
    ]) {
      if (typeof raw !== 'string') continue;

      const match = raw.match(/\b(20\d{2})\b/);

      if (match) {
        const year = Number(match[1]);

        if (year >= 2000 && year <= currentYear) {
          years.push(year);
        }
      }
    }
  }

  return {
    minYear: Math.min(...years),
    maxYear: currentYear
  };
}


function clampParts(
  parts,
  {
    minYear,
    maxYear,
    maxIso
  }
) {
  const year = Math.min(
    Math.max(parts.year, minYear),
    maxYear
  );

  const month = Math.min(
    Math.max(parts.month, 1),
    12
  );

  const maxDay = daysInMonth(year, month);

  const day = Math.min(
    Math.max(parts.day, 1),
    maxDay
  );

  const candidate = {
    day,
    month,
    year
  };

  if (maxIso && toIso(candidate) > maxIso) {
    return fromIso(maxIso);
  }

  return candidate;
}


/* ============================================================
   SMOOTH SPINNER UNIT
   ============================================================ */

function SpinnerUnit({
  label,
  displayValue,
  onIncrement,
  onDecrement,
  onSelectCurrent,
  disableUp = false,
  disableDown = false,
  className = ''
}) {
  const unitRef = useRef(null);

  const handlersRef = useRef({
    onIncrement,
    onDecrement,
    disableUp,
    disableDown
  });

  handlersRef.current = {
    onIncrement,
    onDecrement,
    disableUp,
    disableDown
  };


  useEffect(() => {
    const element = unitRef.current;

    if (!element) {
      return undefined;
    }


    /*
     * Wheel tuning
     *
     * Higher threshold = more wheel movement required
     * Higher delay     = slower repeated changes
     *
     * Recommended:
     * threshold: 70 - 100
     * delay: 100 - 150 ms
     */

    const SCROLL_THRESHOLD = 60;
    const SCROLL_DELAY = 120;


    let accumulatedDelta = 0;
    let scrollLocked = false;

    let unlockTimer = null;


    const unlockScroll = () => {
      scrollLocked = false;
    };


    const onWheel = (event) => {
      event.preventDefault();

      /*
       * Ignore additional wheel events while the
       * previous value change is settling.
       */
      if (scrollLocked) {
        return;
      }


      /*
       * Trackpad usually generates many tiny events.
       * Mouse wheel usually generates larger events.
       *
       * Accumulating delta makes both behave similarly.
       */
      accumulatedDelta += event.deltaY;


      /*
       * Don't change anything until enough movement
       * has accumulated.
       */
      if (
        Math.abs(accumulatedDelta) <
        SCROLL_THRESHOLD
      ) {
        return;
      }


      /*
       * Wheel upward
       */
      if (accumulatedDelta < 0) {
        if (!handlersRef.current.disableUp) {
          handlersRef.current.onIncrement();
        }
      }


      /*
       * Wheel downward
       */
      if (accumulatedDelta > 0) {
        if (!handlersRef.current.disableDown) {
          handlersRef.current.onDecrement();
        }
      }


      /*
       * Reset accumulated movement
       */
      accumulatedDelta = 0;


      /*
       * Temporarily lock further scrolling.
       * This prevents one gesture from changing
       * several dates immediately.
       */
      scrollLocked = true;


      clearTimeout(unlockTimer);

      unlockTimer = setTimeout(
        unlockScroll,
        SCROLL_DELAY
      );
    };


    element.addEventListener(
      'wheel',
      onWheel,
      {
        passive: false
      }
    );


    return () => {
      element.removeEventListener(
        'wheel',
        onWheel
      );

      clearTimeout(unlockTimer);
    };
  }, []);


  const handleKeyDown = (event) => {
    if (event.key === 'ArrowUp') {
      event.preventDefault();

      if (!disableUp) {
        onIncrement();
      }
    }

    else if (event.key === 'ArrowDown') {
      event.preventDefault();

      if (!disableDown) {
        onDecrement();
      }
    }
  };


  return (
    <div
      ref={unitRef}
      className={`rr-audit-spin-unit ${className}`}
      title="Use arrows or scroll wheel to adjust"
    >

      <button
        type="button"
        className="rr-audit-spin-arrow"
        aria-label={`Increase ${label}`}
        disabled={disableUp}
        onClick={onIncrement}
      >
        <ChevronUp
          size={14}
          strokeWidth={2.2}
          aria-hidden="true"
        />
      </button>


      <span
        className="rr-audit-spin-value"
        role="spinbutton"
        tabIndex={0}
        aria-label={label}
        aria-valuetext={String(displayValue)}
        onClick={onSelectCurrent}
        onKeyDown={handleKeyDown}
      >
        {displayValue}
      </span>


      <button
        type="button"
        className="rr-audit-spin-arrow"
        aria-label={`Decrease ${label}`}
        disabled={disableDown}
        onClick={onDecrement}
      >
        <ChevronDown
          size={14}
          strokeWidth={2.2}
          aria-hidden="true"
        />
      </button>

    </div>
  );
}


/* ============================================================
   DATE SPINNER GROUP
   ============================================================ */

function DateSpinnerGroup({
  groupLabel,
  parts,
  onChangeParts,
  minYear,
  maxYear,
  maxIso,
  minIso
}) {
  const maxDayInMonth = daysInMonth(
    parts.year,
    parts.month
  );


  const adjust = (field, delta) => {
    let next = {
      ...parts
    };


    /*
     * DAY
     */
    if (field === 'day') {
      let nextDay = next.day + delta;


      /*
       * Loop:
       *
       * 31 -> 1
       * 1  -> 31
       */
      if (nextDay > maxDayInMonth) {
        nextDay = 1;
      }

      if (nextDay < 1) {
        nextDay = maxDayInMonth;
      }

      next.day = nextDay;
    }


    /*
     * MONTH
     */
    else if (field === 'month') {
      let nextMonth = next.month + delta;


      /*
       * Loop:
       *
       * Dec -> Jan
       * Jan -> Dec
       */
      if (nextMonth > 12) {
        nextMonth = 1;
      }

      if (nextMonth < 1) {
        nextMonth = 12;
      }


      next.month = nextMonth;


      /*
       * Fix invalid day:
       *
       * 31 Jan -> Feb
       *
       * automatically becomes:
       *
       * 28/29 Feb
       */
      next.day = Math.min(
        next.day,
        daysInMonth(
          next.year,
          next.month
        )
      );
    }


    /*
     * YEAR
     */
    else if (field === 'year') {
      const nextYear = Math.min(
        Math.max(
          next.year + delta,
          minYear
        ),
        maxYear
      );


      next.year = nextYear;


      /*
       * Handles leap-year changes.
       *
       * Example:
       *
       * 29 Feb 2024
       * ↓
       * 28 Feb 2023
       */
      next.day = Math.min(
        next.day,
        daysInMonth(
          next.year,
          next.month
        )
      );
    }


    /*
     * Prevent dates outside valid range.
     */
    next = clampParts(
      next,
      {
        minYear,
        maxYear,
        maxIso
      }
    );


    /*
     * End Date cannot go before Start Date.
     */
    if (
      minIso &&
      toIso(next) < minIso
    ) {
      next = fromIso(minIso);
    }


    onChangeParts(next);
  };


  const atMaxIso = Boolean(
    maxIso &&
    toIso(parts) >= maxIso
  );


  const atMinIso = Boolean(
    minIso &&
    toIso(parts) <= minIso
  );


  return (
    <div
      className="rr-audit-spin-group"
      role="group"
      aria-label={`${groupLabel} Date`}
    >

      <span className="rr-audit-spin-label">
        {groupLabel}
      </span>


      <div className="rr-audit-spin-row">

        {/* DAY */}

        <SpinnerUnit
          label={`${groupLabel} Day`}
          displayValue={pad(parts.day)}
          className="rr-spin-day"

          disableUp={
            atMaxIso &&
            parts.day >=
              Number(
                maxIso.split('-')[2]
              )
          }

          disableDown={
            atMinIso &&
            parts.day <=
              Number(
                minIso.split('-')[2]
              )
          }

          onIncrement={() =>
            adjust('day', 1)
          }

          onDecrement={() =>
            adjust('day', -1)
          }

          onSelectCurrent={() =>
            onChangeParts(parts)
          }
        />


        {/* MONTH */}

        <SpinnerUnit
          label={`${groupLabel} Month`}
          displayValue={
            MONTHS[
              parts.month - 1
            ]
          }
          className="rr-spin-month"

          disableUp={
            atMaxIso &&
            parts.year ===
              Number(
                maxIso.split('-')[0]
              ) &&
            parts.month >=
              Number(
                maxIso.split('-')[1]
              )
          }

          disableDown={
            atMinIso &&
            parts.year ===
              Number(
                minIso.split('-')[0]
              ) &&
            parts.month <=
              Number(
                minIso.split('-')[1]
              )
          }

          onIncrement={() =>
            adjust('month', 1)
          }

          onDecrement={() =>
            adjust('month', -1)
          }

          onSelectCurrent={() =>
            onChangeParts(parts)
          }
        />


        {/* YEAR */}

        <SpinnerUnit
          label={`${groupLabel} Year`}
          displayValue={parts.year}
          className="rr-spin-year"

          disableUp={
            parts.year >= maxYear
          }

          disableDown={
            parts.year <= minYear ||
            (
              atMinIso &&
              parts.year <=
                Number(
                  minIso.split('-')[0]
                )
            )
          }

          onIncrement={() =>
            adjust('year', 1)
          }

          onDecrement={() =>
            adjust('year', -1)
          }

          onSelectCurrent={() =>
            onChangeParts(parts)
          }
        />

      </div>

    </div>
  );
}


/* ============================================================
   AUDIT FILTERS
   ============================================================ */

export default function AuditFilters({
  filters,
  onChange,
  officers,
  records = []
}) {

  const [open, setOpen] = useState(false);

  const rangeWrapperRef = useRef(null);


  const update = (fields) => {
    onChange({
      ...filters,
      ...fields
    });
  };


  const error = dateRangeError(filters);


  /*
   * Close picker when clicking outside.
   */
  useEffect(() => {
    if (!open) {
      return undefined;
    }


    const handleOutside = (event) => {
      if (
        rangeWrapperRef.current &&
        !rangeWrapperRef.current.contains(
          event.target
        )
      ) {
        setOpen(false);
      }
    };


    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };


    document.addEventListener(
      'mousedown',
      handleOutside
    );

    document.addEventListener(
      'keydown',
      handleEscape
    );


    return () => {
      document.removeEventListener(
        'mousedown',
        handleOutside
      );

      document.removeEventListener(
        'keydown',
        handleEscape
      );
    };
  }, [open]);


  /*
   * Today's date
   */
  const now = new Date();


  const todayIso =
    `${now.getFullYear()}-` +
    `${pad(now.getMonth() + 1)}-` +
    `${pad(now.getDate())}`;


  /*
   * Find allowed year range.
   */
  const {
    minYear,
    maxYear
  } = deriveYearBounds(
    records,
    now
  );


  /*
   * Current selected date parts.
   */
  const startParts = toParts(
    filters.from,
    now
  );


  const endParts = toParts(
    filters.to,
    now
  );


  const startIso = toIso(
    startParts
  );


  const hasRange = Boolean(
    parseFilterDate(filters.from) &&
    parseFilterDate(filters.to)
  );


  /*
   * Text displayed inside Date Range box.
   */
  const boxDisplayLabel = hasRange
    ? `${toReadable(startParts)} — ${toReadable(endParts)}`
    : 'Select a Range';


  /*
   * START DATE CHANGE
   */
  const handleStartChange = (
    nextStart
  ) => {

    const clampedStart =
      clampParts(
        nextStart,
        {
          minYear,
          maxYear,
          maxIso: todayIso
        }
      );


    const nextStartIso =
      toIso(clampedStart);


    const currentEndIso =
      toIso(endParts);


    /*
     * If Start Date becomes later than End Date,
     * automatically move End Date to Start Date.
     */
    const finalEnd =
      nextStartIso >
      currentEndIso
        ? clampedStart
        : endParts;


    update({
      from: toDisplay(
        clampedStart
      ),

      to: toDisplay(
        finalEnd
      ),

      period: 'custom'
    });
  };


  /*
   * END DATE CHANGE
   */
  const handleEndChange = (
    nextEnd
  ) => {

    let clampedEnd =
      clampParts(
        nextEnd,
        {
          minYear,
          maxYear,
          maxIso: todayIso
        }
      );


    /*
     * End Date cannot be before Start Date.
     */
    if (
      toIso(clampedEnd) <
      startIso
    ) {
      clampedEnd = {
        ...startParts
      };
    }


    update({
      from: toDisplay(
        startParts
      ),

      to: toDisplay(
        clampedEnd
      ),

      period: 'custom'
    });
  };


  return (
    <div
      className="rr-audit-filters"
      role="search"
      aria-label="Filter audit logs"
    >

      <div className="rr-audit-filter-row">

        {/* SEARCH */}

        <div className="rr-audit-search">

          <Search
            size={16}
            aria-hidden="true"
          />

          <input
            aria-label="Search order or defaulter"
            placeholder="Search order / defaulter..."
            value={filters.search}
            onChange={(event) =>
              update({
                search:
                  event.target.value
              })
            }
          />


          {filters.search && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() =>
                update({
                  search: ''
                })
              }
            >
              <X size={14} />
            </button>
          )}

        </div>





        {/* DATE RANGE */}

        <div
          className="rr-audit-date-dropdown"
          ref={rangeWrapperRef}
        >

          <button
            type="button"

            className={`
              rr-audit-date-trigger
              ${open ? 'active' : ''}
              ${hasRange ? 'has-value' : ''}
            `}

            aria-label="Date range"
            aria-expanded={open}
            aria-haspopup="dialog"

            aria-describedby={
              error
                ? 'rr-audit-date-error'
                : undefined
            }

            onClick={() =>
              setOpen(
                (prev) => !prev
              )
            }
          >

            <span className="rr-audit-date-trigger-text">
              {boxDisplayLabel}
            </span>

            <Calendar
              size={15}
              aria-hidden="true"
            />

          </button>


          {open && (

            <div
              className="rr-audit-date-popover"
              role="dialog"
              aria-label="Select date range"
            >

              <div className="rr-audit-date-popover-inner">

                {/* START */}

                <DateSpinnerGroup
                  groupLabel="Start"

                  parts={
                    startParts
                  }

                  onChangeParts={
                    handleStartChange
                  }

                  minYear={
                    minYear
                  }

                  maxYear={
                    maxYear
                  }

                  maxIso={
                    todayIso
                  }
                />


                <span
                  className="rr-audit-spin-sep"
                  aria-hidden="true"
                >
                  —
                </span>


                {/* END */}

                <DateSpinnerGroup
                  groupLabel="End"

                  parts={
                    endParts
                  }

                  onChangeParts={
                    handleEndChange
                  }

                  minYear={
                    minYear
                  }

                  maxYear={
                    maxYear
                  }

                  maxIso={
                    todayIso
                  }

                  minIso={
                    startIso
                  }
                />

              </div>

            </div>
          )}

        </div>


        {/* PERIOD */}

        <select
          aria-label="Period"
          value={filters.period}

          onChange={(event) => {

            const period =
              event.target.value;


            update({
              period,

              ...(
                period === ''
                  ? {
                      from: '',
                      to: ''
                    }

                  : period !==
                    'custom'

                  ? periodRange(
                      period
                    )

                  : {}
              )
            });

          }}
        >

          <option value="">
            All Periods
          </option>

          <option value="today">
            Today
          </option>

          <option value="week">
            This Week
          </option>

          <option value="month">
            This Month
          </option>

          <option value="custom">
            Custom
          </option>

        </select>


        {/* RESET */}

        <button
          type="button"
          className="rr-audit-reset"

          onClick={() => {

            setOpen(false);

            onChange(
              emptyAuditFilters()
            );

          }}
        >

          <RotateCcw
            size={15}
            aria-hidden="true"
          />

          Reset

        </button>

      </div>


      {/* ERROR */}

      {error && (
        <p
          id="rr-audit-date-error"
          role="alert"
        >
          {error}
        </p>
      )}

    </div>
  );
}