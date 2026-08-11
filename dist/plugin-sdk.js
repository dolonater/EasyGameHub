var S1 = Object.defineProperty;
var B1 = (t, o, n) => o in t ? S1(t, o, { enumerable: !0, configurable: !0, writable: !0, value: n }) : t[o] = n;
var Y = (t, o, n) => B1(t, typeof o != "symbol" ? o + "" : o, n);
import n0, { forwardRef as q0, useState as z, useRef as c0, useEffect as u0, useCallback as G0, useContext as P1, Fragment as O1, createElement as j1 } from "react";
import { Fragment as o8, createElement as s8, useCallback as n8, useContext as c8, useEffect as u8, useRef as v8, useState as g8 } from "react";
import { createPortal as T1 } from "react-dom";
function F1(t, o = !1) {
  return window.__TAURI_INTERNALS__.transformCallback(t, o);
}
async function v(t, o = {}, n) {
  return window.__TAURI_INTERNALS__.invoke(t, o, n);
}
var O0;
(function(t) {
  t.WINDOW_RESIZED = "tauri://resize", t.WINDOW_MOVED = "tauri://move", t.WINDOW_CLOSE_REQUESTED = "tauri://close-requested", t.WINDOW_DESTROYED = "tauri://destroyed", t.WINDOW_FOCUS = "tauri://focus", t.WINDOW_BLUR = "tauri://blur", t.WINDOW_SCALE_FACTOR_CHANGED = "tauri://scale-change", t.WINDOW_THEME_CHANGED = "tauri://theme-changed", t.WINDOW_CREATED = "tauri://window-created", t.WINDOW_SUSPENDED = "tauri://suspended", t.WINDOW_RESUMED = "tauri://resumed", t.WEBVIEW_CREATED = "tauri://webview-created", t.DRAG_ENTER = "tauri://drag-enter", t.DRAG_OVER = "tauri://drag-over", t.DRAG_DROP = "tauri://drag-drop", t.DRAG_LEAVE = "tauri://drag-leave";
})(O0 || (O0 = {}));
async function D1(t, o) {
  window.__TAURI_EVENT_PLUGIN_INTERNALS__.unregisterListener(t, o), await v("plugin:event|unlisten", {
    event: t,
    eventId: o
  });
}
async function N1(t, o, n) {
  var i;
  const l = (i = void 0) !== null && i !== void 0 ? i : { kind: "Any" };
  return v("plugin:event|listen", {
    event: t,
    target: l,
    handler: F1(o)
  }).then((r) => async () => D1(t, r));
}
const K = /* @__PURE__ */ new Map(), j0 = /* @__PURE__ */ new Map(), I1 = ["backup:started", "backup:completed", "backup:failed"];
let T0 = !1;
function $1() {
  if (!T0) {
    T0 = !0;
    for (const t of I1)
      N1(t, (o) => W1(t, o.payload)).catch((o) => {
        console.error(`[plugins:events] failed to listen ${t}:`, o);
      });
  }
}
function W1(t, o) {
  const n = K.get(t);
  if (n)
    for (const i of Array.from(n))
      try {
        i(o);
      } catch (l) {
        console.error(`[plugins:events] handler for "${t}" threw:`, l);
      }
}
function U1(t, o) {
  let n = K.get(t);
  n || (n = /* @__PURE__ */ new Set(), K.set(t, n)), n.add(o);
}
function Y1(t, o) {
  var n;
  (n = K.get(t)) == null || n.delete(o);
}
function q1(t, o, n) {
  U1(o, n);
  let i = j0.get(t);
  i || (i = [], j0.set(t, i)), i.push({ event: o, handler: n }), $1();
}
var s0 = { exports: {} }, F = {};
/**
 * @license React
 * react-jsx-runtime.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var F0;
function G1() {
  if (F0) return F;
  F0 = 1;
  var t = n0, o = Symbol.for("react.element"), n = Symbol.for("react.fragment"), i = Object.prototype.hasOwnProperty, l = t.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner, r = { key: !0, ref: !0, __self: !0, __source: !0 };
  function s(p, m, H) {
    var A, h = {}, C = null, k = null;
    H !== void 0 && (C = "" + H), m.key !== void 0 && (C = "" + m.key), m.ref !== void 0 && (k = m.ref);
    for (A in m) i.call(m, A) && !r.hasOwnProperty(A) && (h[A] = m[A]);
    if (p && p.defaultProps) for (A in m = p.defaultProps, m) h[A] === void 0 && (h[A] = m[A]);
    return { $$typeof: o, type: p, key: C, ref: k, props: h, _owner: l.current };
  }
  return F.Fragment = n, F.jsx = s, F.jsxs = s, F;
}
var D = {};
/**
 * @license React
 * react-jsx-runtime.development.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var D0;
function z1() {
  return D0 || (D0 = 1, process.env.NODE_ENV !== "production" && function() {
    var t = n0, o = Symbol.for("react.element"), n = Symbol.for("react.portal"), i = Symbol.for("react.fragment"), l = Symbol.for("react.strict_mode"), r = Symbol.for("react.profiler"), s = Symbol.for("react.provider"), p = Symbol.for("react.context"), m = Symbol.for("react.forward_ref"), H = Symbol.for("react.suspense"), A = Symbol.for("react.suspense_list"), h = Symbol.for("react.memo"), C = Symbol.for("react.lazy"), k = Symbol.for("react.offscreen"), N = Symbol.iterator, J = "@@iterator";
    function L(e) {
      if (e === null || typeof e != "object")
        return null;
      var a = N && e[N] || e[J];
      return typeof a == "function" ? a : null;
    }
    var B = t.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
    function y(e) {
      {
        for (var a = arguments.length, c = new Array(a > 1 ? a - 1 : 0), u = 1; u < a; u++)
          c[u - 1] = arguments[u];
        J0("error", e, c);
      }
    }
    function J0(e, a, c) {
      {
        var u = B.ReactDebugCurrentFrame, f = u.getStackAddendum();
        f !== "" && (a += "%s", c = c.concat([f]));
        var b = c.map(function(d) {
          return String(d);
        });
        b.unshift("Warning: " + a), Function.prototype.apply.call(console[e], console, b);
      }
    }
    var X0 = !1, e1 = !1, r1 = !1, i1 = !1, t1 = !1, v0;
    v0 = Symbol.for("react.module.reference");
    function a1(e) {
      return !!(typeof e == "string" || typeof e == "function" || e === i || e === r || t1 || e === l || e === H || e === A || i1 || e === k || X0 || e1 || r1 || typeof e == "object" && e !== null && (e.$$typeof === C || e.$$typeof === h || e.$$typeof === s || e.$$typeof === p || e.$$typeof === m || // This needs to include all possible module reference object
      // types supported by any Flight configuration anywhere since
      // we don't know which Flight build this will end up being used
      // with.
      e.$$typeof === v0 || e.getModuleId !== void 0));
    }
    function l1(e, a, c) {
      var u = e.displayName;
      if (u)
        return u;
      var f = a.displayName || a.name || "";
      return f !== "" ? c + "(" + f + ")" : c;
    }
    function g0(e) {
      return e.displayName || "Context";
    }
    function E(e) {
      if (e == null)
        return null;
      if (typeof e.tag == "number" && y("Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue."), typeof e == "function")
        return e.displayName || e.name || null;
      if (typeof e == "string")
        return e;
      switch (e) {
        case i:
          return "Fragment";
        case n:
          return "Portal";
        case r:
          return "Profiler";
        case l:
          return "StrictMode";
        case H:
          return "Suspense";
        case A:
          return "SuspenseList";
      }
      if (typeof e == "object")
        switch (e.$$typeof) {
          case p:
            var a = e;
            return g0(a) + ".Consumer";
          case s:
            var c = e;
            return g0(c._context) + ".Provider";
          case m:
            return l1(e, e.render, "ForwardRef");
          case h:
            var u = e.displayName || null;
            return u !== null ? u : E(e.type) || "Memo";
          case C: {
            var f = e, b = f._payload, d = f._init;
            try {
              return E(d(b));
            } catch {
              return null;
            }
          }
        }
      return null;
    }
    var R = Object.assign, j = 0, d0, p0, f0, b0, w0, h0, m0;
    function _0() {
    }
    _0.__reactDisabledLog = !0;
    function o1() {
      {
        if (j === 0) {
          d0 = console.log, p0 = console.info, f0 = console.warn, b0 = console.error, w0 = console.group, h0 = console.groupCollapsed, m0 = console.groupEnd;
          var e = {
            configurable: !0,
            enumerable: !0,
            value: _0,
            writable: !0
          };
          Object.defineProperties(console, {
            info: e,
            log: e,
            warn: e,
            error: e,
            group: e,
            groupCollapsed: e,
            groupEnd: e
          });
        }
        j++;
      }
    }
    function s1() {
      {
        if (j--, j === 0) {
          var e = {
            configurable: !0,
            enumerable: !0,
            writable: !0
          };
          Object.defineProperties(console, {
            log: R({}, e, {
              value: d0
            }),
            info: R({}, e, {
              value: p0
            }),
            warn: R({}, e, {
              value: f0
            }),
            error: R({}, e, {
              value: b0
            }),
            group: R({}, e, {
              value: w0
            }),
            groupCollapsed: R({}, e, {
              value: h0
            }),
            groupEnd: R({}, e, {
              value: m0
            })
          });
        }
        j < 0 && y("disabledDepth fell below zero. This is a bug in React. Please file an issue.");
      }
    }
    var X = B.ReactCurrentDispatcher, e0;
    function I(e, a, c) {
      {
        if (e0 === void 0)
          try {
            throw Error();
          } catch (f) {
            var u = f.stack.trim().match(/\n( *(at )?)/);
            e0 = u && u[1] || "";
          }
        return `
` + e0 + e;
      }
    }
    var r0 = !1, $;
    {
      var n1 = typeof WeakMap == "function" ? WeakMap : Map;
      $ = new n1();
    }
    function x0(e, a) {
      if (!e || r0)
        return "";
      {
        var c = $.get(e);
        if (c !== void 0)
          return c;
      }
      var u;
      r0 = !0;
      var f = Error.prepareStackTrace;
      Error.prepareStackTrace = void 0;
      var b;
      b = X.current, X.current = null, o1();
      try {
        if (a) {
          var d = function() {
            throw Error();
          };
          if (Object.defineProperty(d.prototype, "props", {
            set: function() {
              throw Error();
            }
          }), typeof Reflect == "object" && Reflect.construct) {
            try {
              Reflect.construct(d, []);
            } catch (V) {
              u = V;
            }
            Reflect.construct(e, [], d);
          } else {
            try {
              d.call();
            } catch (V) {
              u = V;
            }
            e.call(d.prototype);
          }
        } else {
          try {
            throw Error();
          } catch (V) {
            u = V;
          }
          e();
        }
      } catch (V) {
        if (V && u && typeof V.stack == "string") {
          for (var g = V.stack.split(`
`), Z = u.stack.split(`
`), _ = g.length - 1, x = Z.length - 1; _ >= 1 && x >= 0 && g[_] !== Z[x]; )
            x--;
          for (; _ >= 1 && x >= 0; _--, x--)
            if (g[_] !== Z[x]) {
              if (_ !== 1 || x !== 1)
                do
                  if (_--, x--, x < 0 || g[_] !== Z[x]) {
                    var M = `
` + g[_].replace(" at new ", " at ");
                    return e.displayName && M.includes("<anonymous>") && (M = M.replace("<anonymous>", e.displayName)), typeof e == "function" && $.set(e, M), M;
                  }
                while (_ >= 1 && x >= 0);
              break;
            }
        }
      } finally {
        r0 = !1, X.current = b, s1(), Error.prepareStackTrace = f;
      }
      var O = e ? e.displayName || e.name : "", S = O ? I(O) : "";
      return typeof e == "function" && $.set(e, S), S;
    }
    function c1(e, a, c) {
      return x0(e, !1);
    }
    function u1(e) {
      var a = e.prototype;
      return !!(a && a.isReactComponent);
    }
    function W(e, a, c) {
      if (e == null)
        return "";
      if (typeof e == "function")
        return x0(e, u1(e));
      if (typeof e == "string")
        return I(e);
      switch (e) {
        case H:
          return I("Suspense");
        case A:
          return I("SuspenseList");
      }
      if (typeof e == "object")
        switch (e.$$typeof) {
          case m:
            return c1(e.render);
          case h:
            return W(e.type, a, c);
          case C: {
            var u = e, f = u._payload, b = u._init;
            try {
              return W(b(f), a, c);
            } catch {
            }
          }
        }
      return "";
    }
    var T = Object.prototype.hasOwnProperty, A0 = {}, y0 = B.ReactDebugCurrentFrame;
    function U(e) {
      if (e) {
        var a = e._owner, c = W(e.type, e._source, a ? a.type : null);
        y0.setExtraStackFrame(c);
      } else
        y0.setExtraStackFrame(null);
    }
    function v1(e, a, c, u, f) {
      {
        var b = Function.call.bind(T);
        for (var d in e)
          if (b(e, d)) {
            var g = void 0;
            try {
              if (typeof e[d] != "function") {
                var Z = Error((u || "React class") + ": " + c + " type `" + d + "` is invalid; it must be a function, usually from the `prop-types` package, but received `" + typeof e[d] + "`.This often happens because of typos such as `PropTypes.function` instead of `PropTypes.func`.");
                throw Z.name = "Invariant Violation", Z;
              }
              g = e[d](a, d, u, c, null, "SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED");
            } catch (_) {
              g = _;
            }
            g && !(g instanceof Error) && (U(f), y("%s: type specification of %s `%s` is invalid; the type checker function must return `null` or an `Error` but returned a %s. You may have forgotten to pass an argument to the type checker creator (arrayOf, instanceOf, objectOf, oneOf, oneOfType, and shape all require an argument).", u || "React class", c, d, typeof g), U(null)), g instanceof Error && !(g.message in A0) && (A0[g.message] = !0, U(f), y("Failed %s type: %s", c, g.message), U(null));
          }
      }
    }
    var g1 = Array.isArray;
    function i0(e) {
      return g1(e);
    }
    function d1(e) {
      {
        var a = typeof Symbol == "function" && Symbol.toStringTag, c = a && e[Symbol.toStringTag] || e.constructor.name || "Object";
        return c;
      }
    }
    function p1(e) {
      try {
        return Z0(e), !1;
      } catch {
        return !0;
      }
    }
    function Z0(e) {
      return "" + e;
    }
    function V0(e) {
      if (p1(e))
        return y("The provided key is an unsupported type %s. This value must be coerced to a string before before using it here.", d1(e)), Z0(e);
    }
    var H0 = B.ReactCurrentOwner, f1 = {
      key: !0,
      ref: !0,
      __self: !0,
      __source: !0
    }, C0, M0;
    function b1(e) {
      if (T.call(e, "ref")) {
        var a = Object.getOwnPropertyDescriptor(e, "ref").get;
        if (a && a.isReactWarning)
          return !1;
      }
      return e.ref !== void 0;
    }
    function w1(e) {
      if (T.call(e, "key")) {
        var a = Object.getOwnPropertyDescriptor(e, "key").get;
        if (a && a.isReactWarning)
          return !1;
      }
      return e.key !== void 0;
    }
    function h1(e, a) {
      typeof e.ref == "string" && H0.current;
    }
    function m1(e, a) {
      {
        var c = function() {
          C0 || (C0 = !0, y("%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://reactjs.org/link/special-props)", a));
        };
        c.isReactWarning = !0, Object.defineProperty(e, "key", {
          get: c,
          configurable: !0
        });
      }
    }
    function _1(e, a) {
      {
        var c = function() {
          M0 || (M0 = !0, y("%s: `ref` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://reactjs.org/link/special-props)", a));
        };
        c.isReactWarning = !0, Object.defineProperty(e, "ref", {
          get: c,
          configurable: !0
        });
      }
    }
    var x1 = function(e, a, c, u, f, b, d) {
      var g = {
        // This tag allows us to uniquely identify this as a React Element
        $$typeof: o,
        // Built-in properties that belong on the element
        type: e,
        key: a,
        ref: c,
        props: d,
        // Record the component responsible for creating this element.
        _owner: b
      };
      return g._store = {}, Object.defineProperty(g._store, "validated", {
        configurable: !1,
        enumerable: !1,
        writable: !0,
        value: !1
      }), Object.defineProperty(g, "_self", {
        configurable: !1,
        enumerable: !1,
        writable: !1,
        value: u
      }), Object.defineProperty(g, "_source", {
        configurable: !1,
        enumerable: !1,
        writable: !1,
        value: f
      }), Object.freeze && (Object.freeze(g.props), Object.freeze(g)), g;
    };
    function A1(e, a, c, u, f) {
      {
        var b, d = {}, g = null, Z = null;
        c !== void 0 && (V0(c), g = "" + c), w1(a) && (V0(a.key), g = "" + a.key), b1(a) && (Z = a.ref, h1(a, f));
        for (b in a)
          T.call(a, b) && !f1.hasOwnProperty(b) && (d[b] = a[b]);
        if (e && e.defaultProps) {
          var _ = e.defaultProps;
          for (b in _)
            d[b] === void 0 && (d[b] = _[b]);
        }
        if (g || Z) {
          var x = typeof e == "function" ? e.displayName || e.name || "Unknown" : e;
          g && m1(d, x), Z && _1(d, x);
        }
        return x1(e, g, Z, f, u, H0.current, d);
      }
    }
    var t0 = B.ReactCurrentOwner, k0 = B.ReactDebugCurrentFrame;
    function P(e) {
      if (e) {
        var a = e._owner, c = W(e.type, e._source, a ? a.type : null);
        k0.setExtraStackFrame(c);
      } else
        k0.setExtraStackFrame(null);
    }
    var a0;
    a0 = !1;
    function l0(e) {
      return typeof e == "object" && e !== null && e.$$typeof === o;
    }
    function L0() {
      {
        if (t0.current) {
          var e = E(t0.current.type);
          if (e)
            return `

Check the render method of \`` + e + "`.";
        }
        return "";
      }
    }
    function y1(e) {
      return "";
    }
    var E0 = {};
    function Z1(e) {
      {
        var a = L0();
        if (!a) {
          var c = typeof e == "string" ? e : e.displayName || e.name;
          c && (a = `

Check the top-level render call using <` + c + ">.");
        }
        return a;
      }
    }
    function R0(e, a) {
      {
        if (!e._store || e._store.validated || e.key != null)
          return;
        e._store.validated = !0;
        var c = Z1(a);
        if (E0[c])
          return;
        E0[c] = !0;
        var u = "";
        e && e._owner && e._owner !== t0.current && (u = " It was passed a child from " + E(e._owner.type) + "."), P(e), y('Each child in a list should have a unique "key" prop.%s%s See https://reactjs.org/link/warning-keys for more information.', c, u), P(null);
      }
    }
    function S0(e, a) {
      {
        if (typeof e != "object")
          return;
        if (i0(e))
          for (var c = 0; c < e.length; c++) {
            var u = e[c];
            l0(u) && R0(u, a);
          }
        else if (l0(e))
          e._store && (e._store.validated = !0);
        else if (e) {
          var f = L(e);
          if (typeof f == "function" && f !== e.entries)
            for (var b = f.call(e), d; !(d = b.next()).done; )
              l0(d.value) && R0(d.value, a);
        }
      }
    }
    function V1(e) {
      {
        var a = e.type;
        if (a == null || typeof a == "string")
          return;
        var c;
        if (typeof a == "function")
          c = a.propTypes;
        else if (typeof a == "object" && (a.$$typeof === m || // Note: Memo only checks outer props here.
        // Inner props are checked in the reconciler.
        a.$$typeof === h))
          c = a.propTypes;
        else
          return;
        if (c) {
          var u = E(a);
          v1(c, e.props, "prop", u, e);
        } else if (a.PropTypes !== void 0 && !a0) {
          a0 = !0;
          var f = E(a);
          y("Component %s declared `PropTypes` instead of `propTypes`. Did you misspell the property assignment?", f || "Unknown");
        }
        typeof a.getDefaultProps == "function" && !a.getDefaultProps.isReactClassApproved && y("getDefaultProps is only used on classic React.createClass definitions. Use a static property named `defaultProps` instead.");
      }
    }
    function H1(e) {
      {
        for (var a = Object.keys(e.props), c = 0; c < a.length; c++) {
          var u = a[c];
          if (u !== "children" && u !== "key") {
            P(e), y("Invalid prop `%s` supplied to `React.Fragment`. React.Fragment can only have `key` and `children` props.", u), P(null);
            break;
          }
        }
        e.ref !== null && (P(e), y("Invalid attribute `ref` supplied to `React.Fragment`."), P(null));
      }
    }
    var B0 = {};
    function P0(e, a, c, u, f, b) {
      {
        var d = a1(e);
        if (!d) {
          var g = "";
          (e === void 0 || typeof e == "object" && e !== null && Object.keys(e).length === 0) && (g += " You likely forgot to export your component from the file it's defined in, or you might have mixed up default and named imports.");
          var Z = y1();
          Z ? g += Z : g += L0();
          var _;
          e === null ? _ = "null" : i0(e) ? _ = "array" : e !== void 0 && e.$$typeof === o ? (_ = "<" + (E(e.type) || "Unknown") + " />", g = " Did you accidentally export a JSX literal instead of a component?") : _ = typeof e, y("React.jsx: type is invalid -- expected a string (for built-in components) or a class/function (for composite components) but got: %s.%s", _, g);
        }
        var x = A1(e, a, c, f, b);
        if (x == null)
          return x;
        if (d) {
          var M = a.children;
          if (M !== void 0)
            if (u)
              if (i0(M)) {
                for (var O = 0; O < M.length; O++)
                  S0(M[O], e);
                Object.freeze && Object.freeze(M);
              } else
                y("React.jsx: Static children should always be an array. You are likely explicitly calling React.jsxs or React.jsxDEV. Use the Babel transform instead.");
            else
              S0(M, e);
        }
        if (T.call(a, "key")) {
          var S = E(e), V = Object.keys(a).filter(function(R1) {
            return R1 !== "key";
          }), o0 = V.length > 0 ? "{key: someKey, " + V.join(": ..., ") + ": ...}" : "{key: someKey}";
          if (!B0[S + o0]) {
            var E1 = V.length > 0 ? "{" + V.join(": ..., ") + ": ...}" : "{}";
            y(`A props object containing a "key" prop is being spread into JSX:
  let props = %s;
  <%s {...props} />
React keys must be passed directly to JSX without using spread:
  let props = %s;
  <%s key={someKey} {...props} />`, o0, S, E1, S), B0[S + o0] = !0;
          }
        }
        return e === i ? H1(x) : V1(x), x;
      }
    }
    function C1(e, a, c) {
      return P0(e, a, c, !0);
    }
    function M1(e, a, c) {
      return P0(e, a, c, !1);
    }
    var k1 = M1, L1 = C1;
    D.Fragment = i, D.jsx = k1, D.jsxs = L1;
  }()), D;
}
process.env.NODE_ENV === "production" ? s0.exports = G1() : s0.exports = z1();
var w = s0.exports;
const K1 = {
  primary: "app-glass-button bg-primary text-primary-foreground border border-primary",
  secondary: "app-surface app-glass-button text-foreground border border-border",
  danger: "app-glass-button bg-red-600 text-white border border-red-600",
  outline: "app-surface app-glass-button border border-foreground/20 bg-transparent text-foreground",
  ghost: "app-glass-button border border-transparent bg-transparent text-foreground"
}, Q1 = {
  primary: "hover:bg-primary/90 hover:shadow-inner",
  secondary: "hover:bg-primary/10 hover:shadow-inner",
  danger: "hover:bg-red-600/90 hover:shadow-inner",
  outline: "hover:bg-primary/10 hover:shadow-inner",
  ghost: "hover:bg-primary/10 hover:shadow-inner"
}, N0 = {
  primary: "hsl(var(--primary))",
  secondary: "hsl(var(--card))",
  danger: "#dc2626",
  outline: "",
  ghost: ""
}, J1 = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-5 py-2.5 text-sm",
  lg: "px-8 py-3 text-base"
}, X1 = [
  "inline-flex items-center justify-center gap-1.5 rounded-[var(--radius)] font-medium transition-all duration-200",
  "disabled:opacity-50 disabled:pointer-events-none disabled:translate-y-0 disabled:shadow-none"
].join(" ");
function Yr({
  variant: t = "primary",
  size: o = "md",
  className: n = "",
  style: i,
  children: l,
  ripple: r = !1,
  ...s
}) {
  const p = r && t !== "danger";
  return /* @__PURE__ */ w.jsx(
    "button",
    {
      type: "button",
      className: [
        p ? "btn-ripple" : "btn-no-ripple",
        X1,
        J1[o],
        K1[t],
        Q1[t],
        n
      ].join(" "),
      style: {
        ...p && N0[t] ? { "--btn-ripple": N0[t] } : {},
        ...i
      },
      ...s,
      children: l
    }
  );
}
const ee = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M224,120v96a8,8,0,0,1-8,8H160a8,8,0,0,1-8-8V164a4,4,0,0,0-4-4H108a4,4,0,0,0-4,4v52a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V120a16,16,0,0,1,4.69-11.31l80-80a16,16,0,0,1,22.62,0l80,80A16,16,0,0,1,224,120Z"/></svg>', re = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M247.44,173.75a.68.68,0,0,0,0-.14L231.05,89.44c0-.06,0-.12,0-.18A60.08,60.08,0,0,0,172,40H83.89a59.88,59.88,0,0,0-59,49.52L8.58,173.61a.68.68,0,0,0,0,.14,36,36,0,0,0,60.9,31.71l.35-.37L109.52,160h37l39.71,45.09c.11.13.23.25.35.37A36.08,36.08,0,0,0,212,216a36,36,0,0,0,35.43-42.25ZM104,112H96v8a8,8,0,0,1-16,0v-8H72a8,8,0,0,1,0-16h8V88a8,8,0,0,1,16,0v8h8a8,8,0,0,1,0,16Zm40-8a8,8,0,0,1,8-8h24a8,8,0,0,1,0,16H152A8,8,0,0,1,144,104Zm84.37,87.47a19.84,19.84,0,0,1-12.9,8.23A20.09,20.09,0,0,1,198,194.31L167.8,160H172a60,60,0,0,0,51-28.38l8.74,45A19.82,19.82,0,0,1,228.37,191.47Z"/></svg>', ie = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M232,208a8,8,0,0,1-8,8H32a8,8,0,0,1,0-16h8V136a8,8,0,0,1,8-8H72a8,8,0,0,1,8,8v64H96V88a8,8,0,0,1,8-8h32a8,8,0,0,1,8,8V200h16V40a8,8,0,0,1,8-8h40a8,8,0,0,1,8,8V200h8A8,8,0,0,1,232,208Z"/></svg>', te = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M224,200h-8V40a8,8,0,0,0-8-8H152a8,8,0,0,0-8,8V80H96a8,8,0,0,0-8,8v40H48a8,8,0,0,0-8,8v64H32a8,8,0,0,0,0,16H224a8,8,0,0,0,0-16ZM160,48h40V200H160ZM104,96h40V200H104ZM56,144H88v56H56Z"/></svg>', ae = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M216,40H72A16,16,0,0,0,56,56V72H40A16,16,0,0,0,24,88V200a16,16,0,0,0,16,16H184a16,16,0,0,0,16-16V184h16a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40ZM172,72a12,12,0,1,1-12,12A12,12,0,0,1,172,72Zm12,128H40V88H56v80a16,16,0,0,0,16,16H184Zm32-32H72V120.69l30.34-30.35a8,8,0,0,1,11.32,0L163.31,140,189,114.34a8,8,0,0,1,11.31,0L216,130.07V168Z"/></svg>', le = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M128,24C74.17,24,32,48.6,32,80v96c0,31.4,42.17,56,96,56s96-24.6,96-56V80C224,48.6,181.83,24,128,24Zm80,104c0,9.62-7.88,19.43-21.61,26.92C170.93,163.35,150.19,168,128,168s-42.93-4.65-58.39-13.08C55.88,147.43,48,137.62,48,128V111.36c17.06,15,46.23,24.64,80,24.64s62.94-9.68,80-24.64Zm-21.61,74.92C170.93,211.35,150.19,216,128,216s-42.93-4.65-58.39-13.08C55.88,195.43,48,185.62,48,176V159.36c17.06,15,46.23,24.64,80,24.64s62.94-9.68,80-24.64V176C208,185.62,200.12,195.43,186.39,202.92Z"/></svg>', oe = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M224,128a8,8,0,0,1-8,8H136v80a8,8,0,0,1-16,0V136H40a8,8,0,0,1,0-16h80V40a8,8,0,0,1,16,0v80h80A8,8,0,0,1,224,128Z"/></svg>', se = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M231.92,132.11c-2.09,54-45.83,97.72-99.81,99.81A104.06,104.06,0,0,1,25.6,109.76a4,4,0,0,1,6.77-2.08l43,43a28,28,0,0,0,42.42,34.92l61.1-49.84a36,36,0,1,0-50.71-50.65l-43,52.74L35,87.67a4,4,0,0,1-.76-4.6,104,104,0,0,1,197.7,49ZM121.58,118.55,90.77,156.33A11.83,11.83,0,0,0,88,163.19,12.19,12.19,0,0,0,99.85,176a11.84,11.84,0,0,0,7.78-2.74l0,0,37.78-30.81A36.18,36.18,0,0,1,121.58,118.55ZM175.9,110A20,20,0,1,0,158,127.9,20,20,0,0,0,175.9,110Z"/></svg>', ne = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="64" height="64" fill="#000000"><path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.253 0-2.265-1.014-2.265-2.265z"/></svg>', ce = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M208,80H96V56a32,32,0,0,1,32-32c15.37,0,29.2,11,32.16,25.59a8,8,0,0,0,15.68-3.18C171.32,24.15,151.2,8,128,8A48.05,48.05,0,0,0,80,56V80H48A16,16,0,0,0,32,96V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80Zm-72,78.63V184a8,8,0,0,1-16,0V158.63a24,24,0,1,1,16,0Z"/></svg>', ue = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M164.47,195.63a8,8,0,0,1-6.7,12.37H10.23a8,8,0,0,1-6.7-12.37,95.83,95.83,0,0,1,47.22-37.71,60,60,0,1,1,66.5,0A95.83,95.83,0,0,1,164.47,195.63Zm87.91-.15a95.87,95.87,0,0,0-47.13-37.56A60,60,0,0,0,144.7,54.59a4,4,0,0,0-1.33,6A75.83,75.83,0,0,1,147,150.53a4,4,0,0,0,1.07,5.53,112.32,112.32,0,0,1,29.85,30.83,23.92,23.92,0,0,1,3.65,16.47,4,4,0,0,0,3.95,4.64h60.3a8,8,0,0,0,7.73-5.93A8.22,8.22,0,0,0,252.38,195.48Z"/></svg>', ve = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M200,88V200a16,16,0,0,1-16,16H40a16,16,0,0,1-16-16V88A16,16,0,0,1,40,72H184A16,16,0,0,1,200,88Zm16-48H64a8,8,0,0,0,0,16H216V176a8,8,0,0,0,16,0V56A16,16,0,0,0,216,40Z"/></svg>', I0 = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M74.34,85.66A8,8,0,0,1,85.66,74.34L120,108.69V24a8,8,0,0,1,16,0v84.69l34.34-34.35a8,8,0,0,1,11.32,11.32l-48,48a8,8,0,0,1-11.32,0ZM240,136v64a16,16,0,0,1-16,16H32a16,16,0,0,1-16-16V136a16,16,0,0,1,16-16H84.4a4,4,0,0,1,2.83,1.17L111,145A24,24,0,0,0,145,145l23.8-23.8A4,4,0,0,1,171.6,120H224A16,16,0,0,1,240,136Zm-40,32a12,12,0,1,0-12,12A12,12,0,0,0,200,168Z"/></svg>', ge = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M160.06,40A88.1,88.1,0,0,0,81.29,88.67h0A87.48,87.48,0,0,0,72,127.73,8.18,8.18,0,0,1,64.57,136,8,8,0,0,1,56,128a103.66,103.66,0,0,1,5.34-32.92,4,4,0,0,0-4.75-5.18A64.09,64.09,0,0,0,8,152c0,35.19,29.75,64,65,64H160a88.09,88.09,0,0,0,87.93-91.48C246.11,77.54,207.07,40,160.06,40Z"/></svg>', $0 = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M216.57,39.43A80,80,0,0,0,83.91,120.78L28.69,176A15.86,15.86,0,0,0,24,187.31V216a16,16,0,0,0,16,16H72a8,8,0,0,0,8-8V208H96a8,8,0,0,0,8-8V184h16a8,8,0,0,0,5.66-2.34l9.56-9.57A79.73,79.73,0,0,0,160,176h.1A80,80,0,0,0,216.57,39.43ZM180,92a16,16,0,1,1,16-16A16,16,0,0,1,180,92Z"/></svg>', de = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M216,130.16q.06-2.16,0-4.32l14.92-18.64a8,8,0,0,0,1.48-7.06,107.6,107.6,0,0,0-10.88-26.25,8,8,0,0,0-6-3.93l-23.72-2.64q-1.48-1.56-3-3L186,40.54a8,8,0,0,0-3.94-6,107.29,107.29,0,0,0-26.25-10.86,8,8,0,0,0-7.06,1.48L130.16,40Q128,40,125.84,40L107.2,25.11a8,8,0,0,0-7.06-1.48A107.6,107.6,0,0,0,73.89,34.51a8,8,0,0,0-3.93,6L67.32,64.27q-1.56,1.49-3,3L40.54,70a8,8,0,0,0-6,3.94,107.71,107.71,0,0,0-10.87,26.25,8,8,0,0,0,1.49,7.06L40,125.84Q40,128,40,130.16L25.11,148.8a8,8,0,0,0-1.48,7.06,107.6,107.6,0,0,0,10.88,26.25,8,8,0,0,0,6,3.93l23.72,2.64q1.49,1.56,3,3L70,215.46a8,8,0,0,0,3.94,6,107.71,107.71,0,0,0,26.25,10.87,8,8,0,0,0,7.06-1.49L125.84,216q2.16.06,4.32,0l18.64,14.92a8,8,0,0,0,7.06,1.48,107.21,107.21,0,0,0,26.25-10.88,8,8,0,0,0,3.93-6l2.64-23.72q1.56-1.48,3-3L215.46,186a8,8,0,0,0,6-3.94,107.71,107.71,0,0,0,10.87-26.25,8,8,0,0,0-1.49-7.06ZM128,168a40,40,0,1,1,40-40A40,40,0,0,1,128,168Z"/></svg>', W0 = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm-4,48a12,12,0,1,1-12,12A12,12,0,0,1,124,72Zm12,112a16,16,0,0,1-16-16V128a8,8,0,0,1,0-16,16,16,0,0,1,16,16v40a8,8,0,0,1,0,16Z"/></svg>', pe = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M109.66,146.34a8,8,0,0,1,0,11.32L83.31,184l18.35,18.34A8,8,0,0,1,96,216H48a8,8,0,0,1-8-8V160a8,8,0,0,1,13.66-5.66L72,172.69l26.34-26.35A8,8,0,0,1,109.66,146.34ZM83.31,72l18.35-18.34A8,8,0,0,0,96,40H48a8,8,0,0,0-8,8V96a8,8,0,0,0,13.66,5.66L72,83.31l26.34,26.35a8,8,0,0,0,11.32-11.32ZM208,40H160a8,8,0,0,0-5.66,13.66L172.69,72,146.34,98.34a8,8,0,0,0,11.32,11.32L184,83.31l18.34,18.35A8,8,0,0,0,216,96V48A8,8,0,0,0,208,40Zm3.06,112.61a8,8,0,0,0-8.72,1.73L184,172.69l-26.34-26.35a8,8,0,0,0-11.32,11.32L172.69,184l-18.35,18.34A8,8,0,0,0,160,216h48a8,8,0,0,0,8-8V160A8,8,0,0,0,211.06,152.61Z"/></svg>', fe = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M224,128a8,8,0,0,1-8,8H40a8,8,0,0,1,0-16H216A8,8,0,0,1,224,128ZM40,72H216a8,8,0,0,0,0-16H40a8,8,0,0,0,0,16ZM216,184H40a8,8,0,0,0,0,16H216a8,8,0,0,0,0-16Z"/></svg>', be = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M104,40H56A16,16,0,0,0,40,56v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V56A16,16,0,0,0,104,40Zm0,64H56V56h48v48Zm96-64H152a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V56A16,16,0,0,0,200,40Zm0,64H152V56h48v48Zm-96,32H56a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V152A16,16,0,0,0,104,136Zm0,64H56V152h48v48Zm96-64H152a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V152A16,16,0,0,0,200,136Zm0,64H152V152h48v48Z"/></svg>', we = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M245,110.64A16,16,0,0,0,232,104H216V88a16,16,0,0,0-16-16H130.67L102.94,51.2a16.14,16.14,0,0,0-9.6-3.2H40A16,16,0,0,0,24,64V208h0a8,8,0,0,0,8,8H211.1a8,8,0,0,0,7.59-5.47l28.49-85.47A16.05,16.05,0,0,0,245,110.64ZM93.34,64,123.2,86.4A8,8,0,0,0,128,88h72v16H69.77a16,16,0,0,0-15.18,10.94L40,158.7V64Zm112,136H43.1l26.67-80H232Z"/></svg>', he = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M224,48V96a8,8,0,0,1-8,8H168a8,8,0,0,1,0-16h28.69L182.06,73.37a79.56,79.56,0,0,0-56.13-23.43h-.45A79.52,79.52,0,0,0,69.59,72.71,8,8,0,0,1,58.41,61.27a96,96,0,0,1,135,.79L208,76.69V48a8,8,0,0,1,16,0ZM186.41,183.29a80,80,0,0,1-112.47-.66L59.31,168H88a8,8,0,0,0,0-16H40a8,8,0,0,0-8,8v48a8,8,0,0,0,16,0V179.31l14.63,14.63A95.43,95.43,0,0,0,130,222.06h.53a95.36,95.36,0,0,0,67.07-27.33,8,8,0,0,0-11.18-11.44Z"/></svg>', me = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm-8-80V80a8,8,0,0,1,16,0v56a8,8,0,0,1-16,0Zm20,36a12,12,0,1,1-12-12A12,12,0,0,1,140,172Z"/></svg>', _e = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z"/></svg>', xe = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M213.66,165.66a8,8,0,0,1-11.32,0L128,91.31,53.66,165.66a8,8,0,0,1-11.32-11.32l80-80a8,8,0,0,1,11.32,0l80,80A8,8,0,0,1,213.66,165.66Z"/></svg>', Ae = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M181.66,133.66l-80,80a8,8,0,0,1-11.32-11.32L164.69,128,90.34,53.66a8,8,0,0,1,11.32-11.32l80,80A8,8,0,0,1,181.66,133.66Z"/></svg>', ye = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M216,40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40Zm0,16V158.75l-26.07-26.06a16,16,0,0,0-22.63,0l-20,20-44-44a16,16,0,0,0-22.62,0L40,149.37V56ZM40,172l52-52,80,80H40Zm176,28H194.63l-36-36,20-20L216,181.38V200ZM144,100a12,12,0,1,1,12,12A12,12,0,0,1,144,100Z"/></svg>', Ze = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M216,40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16h64a8,8,0,0,0,7.59-5.47l14.83-44.48L163,151.43a8.07,8.07,0,0,0,4.46-4.46l14.62-36.55,44.48-14.83A8,8,0,0,0,232,88V56A16,16,0,0,0,216,40ZM112.41,157.47,98.23,200H40V172l52-52,30.42,30.42L117,152.57A8,8,0,0,0,112.41,157.47ZM216,82.23,173.47,96.41a8,8,0,0,0-4.9,4.62l-14.72,36.82L138.58,144l-35.27-35.27a16,16,0,0,0-22.62,0L40,149.37V56H216Zm12.68,33a8,8,0,0,0-7.21-1.1l-23.8,7.94a8,8,0,0,0-4.9,4.61l-14.31,35.77-35.77,14.31a8,8,0,0,0-4.61,4.9l-7.94,23.8A8,8,0,0,0,137.73,216H216a16,16,0,0,0,16-16V121.73A8,8,0,0,0,228.68,115.24ZM216,200H148.83l3.25-9.75,35.51-14.2a8.07,8.07,0,0,0,4.46-4.46l14.2-35.51,9.75-3.25Z"/></svg>', Ve = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z"/></svg>', He = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M221.66,133.66l-72,72a8,8,0,0,1-11.32-11.32L196.69,136H40a8,8,0,0,1,0-16H196.69L138.34,61.66a8,8,0,0,1,11.32-11.32l72,72A8,8,0,0,1,221.66,133.66Z"/></svg>', Ce = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z"/></svg>', Me = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M168,112a56,56,0,1,1-56-56A56,56,0,0,1,168,112Zm61.66,117.66a8,8,0,0,1-11.32,0l-50.06-50.07a88,88,0,1,1,11.32-11.31l50.06,50.06A8,8,0,0,1,229.66,229.66ZM112,184a72,72,0,1,0-72-72A72.08,72.08,0,0,0,112,184Z"/></svg>', ke = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M216,32H88a8,8,0,0,0-8,8V80H40a8,8,0,0,0-8,8V216a8,8,0,0,0,8,8H168a8,8,0,0,0,8-8V176h40a8,8,0,0,0,8-8V40A8,8,0,0,0,216,32ZM160,208H48V96H160Zm48-48H176V88a8,8,0,0,0-8-8H96V48H208Z"/></svg>', Le = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M227.31,73.37,182.63,28.68a16,16,0,0,0-22.63,0L36.69,152A15.86,15.86,0,0,0,32,163.31V208a16,16,0,0,0,16,16H92.69A15.86,15.86,0,0,0,104,219.31L227.31,96a16,16,0,0,0,0-22.63ZM51.31,160,136,75.31,152.69,92,68,176.68ZM48,179.31,76.69,208H48Zm48,25.38L79.31,188,164,103.31,180.69,120Zm96-96L147.31,64l24-24L216,84.68Z"/></svg>', Ee = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M216,48H176V40a24,24,0,0,0-24-24H104A24,24,0,0,0,80,40v8H40a8,8,0,0,0,0,16h8V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V64h8a8,8,0,0,0,0-16ZM96,40a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96Zm96,168H64V64H192ZM112,104v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm48,0v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Z"/></svg>', Re = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M248,128a87.34,87.34,0,0,1-17.6,52.81,8,8,0,1,1-12.8-9.62A71.34,71.34,0,0,0,232,128a72,72,0,0,0-144,0,8,8,0,0,1-16,0,88,88,0,0,1,3.29-23.88C74.2,104,73.1,104,72,104a48,48,0,0,0,0,96H96a8,8,0,0,1,0,16H72A64,64,0,1,1,81.29,88.68,88,88,0,0,1,248,128Zm-69.66,42.34L160,188.69V128a8,8,0,0,0-16,0v60.69l-18.34-18.35a8,8,0,0,0-11.32,11.32l32,32a8,8,0,0,0,11.32,0l32-32a8,8,0,0,0-11.32-11.32Z"/></svg>', Se = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M178.34,165.66,160,147.31V208a8,8,0,0,1-16,0V147.31l-18.34,18.35a8,8,0,0,1-11.32-11.32l32-32a8,8,0,0,1,11.32,0l32,32a8,8,0,0,1-11.32,11.32ZM160,40A88.08,88.08,0,0,0,81.29,88.68,64,64,0,1,0,72,216h40a8,8,0,0,0,0-16H72a48,48,0,0,1,0-96c1.1,0,2.2,0,3.29.12A88,88,0,0,0,72,128a8,8,0,0,0,16,0,72,72,0,1,1,100.8,66,8,8,0,0,0,3.2,15.34,7.9,7.9,0,0,0,3.2-.68A88,88,0,0,0,160,40Z"/></svg>', Be = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M224,64H32A16,16,0,0,0,16,80v96a16,16,0,0,0,16,16H224a16,16,0,0,0,16-16V80A16,16,0,0,0,224,64Zm0,112H32V80H224v96Zm-24-48a12,12,0,1,1-12-12A12,12,0,0,1,200,128Z"/></svg>', Pe = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M230.92,212c-15.23-26.33-38.7-45.21-66.09-54.16a72,72,0,1,0-73.66,0C63.78,166.78,40.31,185.66,25.08,212a8,8,0,1,0,13.85,8c18.84-32.56,52.14-52,89.07-52s70.23,19.44,89.07,52a8,8,0,1,0,13.85-8ZM72,96a56,56,0,1,1,56,56A56.06,56.06,0,0,1,72,96Z"/></svg>', Oe = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M128,24h0A104,104,0,1,0,232,128,104.12,104.12,0,0,0,128,24Zm88,104a87.61,87.61,0,0,1-3.33,24H174.16a157.44,157.44,0,0,0,0-48h38.51A87.61,87.61,0,0,1,216,128ZM102,168H154a115.11,115.11,0,0,1-26,45A115.27,115.27,0,0,1,102,168Zm-3.9-16a140.84,140.84,0,0,1,0-48h59.88a140.84,140.84,0,0,1,0,48ZM40,128a87.61,87.61,0,0,1,3.33-24H81.84a157.44,157.44,0,0,0,0,48H43.33A87.61,87.61,0,0,1,40,128ZM154,88H102a115.11,115.11,0,0,1,26-45A115.27,115.27,0,0,1,154,88Zm52.33,0H170.71a135.28,135.28,0,0,0-22.3-45.6A88.29,88.29,0,0,1,206.37,88ZM107.59,42.4A135.28,135.28,0,0,0,85.29,88H49.63A88.29,88.29,0,0,1,107.59,42.4ZM49.63,168H85.29a135.28,135.28,0,0,0,22.3,45.6A88.29,88.29,0,0,1,49.63,168Zm98.78,45.6a135.28,135.28,0,0,0,22.3-45.6h35.66A88.29,88.29,0,0,1,148.41,213.6Z"/></svg>', je = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M224,104a8,8,0,0,1-16,0V59.32l-66.33,66.34a8,8,0,0,1-11.32-11.32L196.68,48H152a8,8,0,0,1,0-16h64a8,8,0,0,1,8,8Zm-40,24a8,8,0,0,0-8,8v72H48V80h72a8,8,0,0,0,0-16H48A16,16,0,0,0,32,80V208a16,16,0,0,0,16,16H176a16,16,0,0,0,16-16V136A8,8,0,0,0,184,128Z"/></svg>', Te = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M208,40H48A24,24,0,0,0,24,64V176a24,24,0,0,0,24,24H208a24,24,0,0,0,24-24V64A24,24,0,0,0,208,40Zm8,136a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V64a8,8,0,0,1,8-8H208a8,8,0,0,1,8,8Zm-48,48a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h64A8,8,0,0,1,168,224Z"/></svg>', Fe = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm71.87,53.27L136,114.14V40.37A88,88,0,0,1,199.87,77.27ZM120,40.37v83l-71.89,41.5A88,88,0,0,1,120,40.37ZM128,216a88,88,0,0,1-71.87-37.27L207.89,91.12A88,88,0,0,1,128,216Z"/></svg>', De = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M112.41,102.53a8,8,0,0,1,5.06-10.12l12-4A8,8,0,0,1,140,96v40a8,8,0,0,1-16,0V107.1l-1.47.49A8,8,0,0,1,112.41,102.53ZM248,208a8,8,0,0,1-8,8H16a8,8,0,0,1,0-16h8V104A16,16,0,0,1,40,88H80V56A16,16,0,0,1,96,40h64a16,16,0,0,1,16,16v72h40a16,16,0,0,1,16,16v56h8A8,8,0,0,1,248,208Zm-72-64v56h40V144ZM96,200h64V56H96Zm-56,0H80V104H40Z"/></svg>', Ne = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm64-88a8,8,0,0,1-8,8H128a8,8,0,0,1-8-8V72a8,8,0,0,1,16,0v48h48A8,8,0,0,1,192,128Z"/></svg>', Ie = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M173.66,98.34a8,8,0,0,1,0,11.32l-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35A8,8,0,0,1,173.66,98.34ZM232,128A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z"/></svg>', $e = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M165.66,101.66,139.31,128l26.35,26.34a8,8,0,0,1-11.32,11.32L128,139.31l-26.34,26.35a8,8,0,0,1-11.32-11.32L116.69,128,90.34,101.66a8,8,0,0,1,11.32-11.32L128,116.69l26.34-26.35a8,8,0,0,1,11.32,11.32ZM232,128A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z"/></svg>', We = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M140,180a12,12,0,1,1-12-12A12,12,0,0,1,140,180ZM128,72c-22.06,0-40,16.15-40,36v4a8,8,0,0,0,16,0v-4c0-11,10.77-20,24-20s24,9,24,20-10.77,20-24,20a8,8,0,0,0-8,8v8a8,8,0,0,0,16,0v-.72c18.24-3.35,32-17.9,32-35.28C168,88.15,150.06,72,128,72Zm104,56A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z"/></svg>', Ue = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"/></svg>', Ye = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z"/></svg>', qe = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M240,96a8,8,0,0,1-8,8H216v16a8,8,0,0,1-16,0V104H184a8,8,0,0,1,0-16h16V72a8,8,0,0,1,16,0V88h16A8,8,0,0,1,240,96ZM144,56h8v8a8,8,0,0,0,16,0V56h8a8,8,0,0,0,0-16h-8V32a8,8,0,0,0-16,0v8h-8a8,8,0,0,0,0,16Zm72.77,97a8,8,0,0,1,1.43,8A96,96,0,1,1,95.07,37.8a8,8,0,0,1,10.6,9.06A88.07,88.07,0,0,0,209.14,150.33,8,8,0,0,1,216.77,153Zm-19.39,14.88c-1.79.09-3.59.14-5.38.14A104.11,104.11,0,0,1,88,64c0-1.79,0-3.59.14-5.38A80,80,0,1,0,197.38,167.86Z"/></svg>', Ge = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M120,40V16a8,8,0,0,1,16,0V40a8,8,0,0,1-16,0Zm72,88a64,64,0,1,1-64-64A64.07,64.07,0,0,1,192,128Zm-16,0a48,48,0,1,0-48,48A48.05,48.05,0,0,0,176,128ZM58.34,69.66A8,8,0,0,0,69.66,58.34l-16-16A8,8,0,0,0,42.34,53.66Zm0,116.68-16,16a8,8,0,0,0,11.32,11.32l16-16a8,8,0,0,0-11.32-11.32ZM192,72a8,8,0,0,0,5.66-2.34l16-16a8,8,0,0,0-11.32-11.32l-16,16A8,8,0,0,0,192,72Zm5.66,114.34a8,8,0,0,0-11.32,11.32l16,16a8,8,0,0,0,11.32-11.32ZM48,128a8,8,0,0,0-8-8H16a8,8,0,0,0,0,16H40A8,8,0,0,0,48,128Zm80,80a8,8,0,0,0-8,8v24a8,8,0,0,0,16,0V216A8,8,0,0,0,128,208Zm112-88H216a8,8,0,0,0,0,16h24a8,8,0,0,0,0-16Z"/></svg>', ze = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M235.32,81.37,174.63,20.69a16,16,0,0,0-22.63,0L98.37,74.49c-10.66-3.34-35-7.37-60.4,13.14a16,16,0,0,0-1.29,23.78L85,159.71,42.34,202.34a8,8,0,0,0,11.32,11.32L96.29,171l48.29,48.29A16,16,0,0,0,155.9,224c.38,0,.75,0,1.13,0a15.93,15.93,0,0,0,11.64-6.33c19.64-26.1,17.75-47.32,13.19-60L235.33,104A16,16,0,0,0,235.32,81.37ZM224,92.69h0l-57.27,57.46a8,8,0,0,0-1.49,9.22c9.46,18.93-1.8,38.59-9.34,48.62L48,100.08c12.08-9.74,23.64-12.31,32.48-12.31A40.13,40.13,0,0,1,96.81,91a8,8,0,0,0,9.25-1.51L163.32,32,224,92.68Z"/></svg>', Ke = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M240,136v64a16,16,0,0,1-16,16H32a16,16,0,0,1-16-16V136a16,16,0,0,1,16-16H80a8,8,0,0,1,0,16H32v64H224V136H176a8,8,0,0,1,0-16h48A16,16,0,0,1,240,136ZM85.66,77.66,120,43.31V128a8,8,0,0,0,16,0V43.31l34.34,34.35a8,8,0,0,0,11.32-11.32l-48-48a8,8,0,0,0-11.32,0l-48,48A8,8,0,0,0,85.66,77.66ZM200,168a12,12,0,1,0-12,12A12,12,0,0,0,200,168Z"/></svg>', Qe = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M221.8,175.94C216.25,166.38,208,139.33,208,104a80,80,0,1,0-160,0c0,35.34-8.26,62.38-13.81,71.94A16,16,0,0,0,48,200H88.81a40,40,0,0,0,78.38,0H208a16,16,0,0,0,13.8-24.06ZM128,216a24,24,0,0,1-22.62-16h45.24A24,24,0,0,1,128,216ZM48,184c7.7-13.24,16-43.92,16-80a64,64,0,1,1,128,0c0,36.05,8.28,66.73,16,80Z"/></svg>', Je = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M224,48H32A16,16,0,0,0,16,64V88a16,16,0,0,0,16,16v88a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V104a16,16,0,0,0,16-16V64A16,16,0,0,0,224,48ZM208,192H48V104H208ZM224,88H32V64H224V88ZM96,136a8,8,0,0,1,8-8h48a8,8,0,0,1,0,16H104A8,8,0,0,1,96,136Z"/></svg>', Xe = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M219.31,72,184,36.69A15.86,15.86,0,0,0,172.69,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V83.31A15.86,15.86,0,0,0,219.31,72ZM168,208H88V152h80Zm40,0H184V152a16,16,0,0,0-16-16H88a16,16,0,0,0-16,16v56H48V48H172.69L208,83.31ZM160,72a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h56A8,8,0,0,1,160,72Z"/></svg>', U0 = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M239.18,97.26A16.38,16.38,0,0,0,224.92,86l-59-4.76L143.14,26.15a16.36,16.36,0,0,0-30.27,0L90.11,81.23,31.08,86a16.46,16.46,0,0,0-9.37,28.86l45,38.83L53,211.75a16.38,16.38,0,0,0,24.5,17.82L128,198.49l50.53,31.08A16.4,16.4,0,0,0,203,211.75l-13.76-58.07,45-38.83A16.43,16.43,0,0,0,239.18,97.26Zm-15.34,5.47-48.7,42a8,8,0,0,0-2.56,7.91l14.88,62.8a.37.37,0,0,1-.17.48c-.18.14-.23.11-.38,0l-54.72-33.65a8,8,0,0,0-8.38,0L69.09,215.94c-.15.09-.19.12-.38,0a.37.37,0,0,1-.17-.48l14.88-62.8a8,8,0,0,0-2.56-7.91l-48.7-42c-.12-.1-.23-.19-.13-.5s.18-.27.33-.29l63.92-5.16A8,8,0,0,0,103,91.86l24.62-59.61c.08-.17.11-.25.35-.25s.27.08.35.25L153,91.86a8,8,0,0,0,6.75,4.92l63.92,5.16c.15,0,.24,0,.33.29S224,102.63,223.84,102.73Z"/></svg>', er = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M178,40c-20.65,0-38.73,8.88-50,23.89C116.73,48.88,98.65,40,78,40a62.07,62.07,0,0,0-62,62c0,70,103.79,126.66,108.21,129a8,8,0,0,0,7.58,0C136.21,228.66,240,172,240,102A62.07,62.07,0,0,0,178,40ZM128,214.8C109.74,204.16,32,155.69,32,102A46.06,46.06,0,0,1,78,56c19.45,0,35.78,10.36,42.6,27a8,8,0,0,0,14.8,0c6.82-16.67,23.15-27,42.6-27a46.06,46.06,0,0,1,46,46C224,155.61,146.24,204.15,128,214.8Z"/></svg>', rr = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M240,102c0,70-103.79,126.66-108.21,129a8,8,0,0,1-7.58,0C119.79,228.66,16,172,16,102A62.07,62.07,0,0,1,78,40c20.65,0,38.73,8.88,50,23.89C139.27,48.88,157.35,40,178,40A62.07,62.07,0,0,1,240,102Z"/></svg>', ir = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M184,32H72A16,16,0,0,0,56,48V224a8,8,0,0,0,12.24,6.78L128,193.43l59.77,37.35A8,8,0,0,0,200,224V48A16,16,0,0,0,184,32Zm0,177.57-51.77-32.35a8,8,0,0,0-8.48,0L72,209.57V48H184Z"/></svg>', tr = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M184,32H72A16,16,0,0,0,56,48V224a8,8,0,0,0,12.24,6.78L128,193.43l59.77,37.35A8,8,0,0,0,200,224V48A16,16,0,0,0,184,32Z"/></svg>', ar = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M247.31,124.76c-.35-.79-8.82-19.58-27.65-38.41C194.57,61.26,162.88,48,128,48S61.43,61.26,36.34,86.35C17.51,105.18,9,124,8.69,124.76a8,8,0,0,0,0,6.5c.35.79,8.82,19.57,27.65,38.4C61.43,194.74,93.12,208,128,208s66.57-13.26,91.66-38.34c18.83-18.83,27.3-37.61,27.65-38.4A8,8,0,0,0,247.31,124.76ZM128,192c-30.78,0-57.67-11.19-79.93-33.25A133.47,133.47,0,0,1,25,128,133.33,133.33,0,0,1,48.07,97.25C70.33,75.19,97.22,64,128,64s57.67,11.19,79.93,33.25A133.46,133.46,0,0,1,231.05,128C223.84,141.46,192.43,192,128,192Zm0-112a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160Z"/></svg>', lr = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M53.92,34.62A8,8,0,1,0,42.08,45.38L61.32,66.55C25,88.84,9.38,123.2,8.69,124.76a8,8,0,0,0,0,6.5c.35.79,8.82,19.57,27.65,38.4C61.43,194.74,93.12,208,128,208a127.11,127.11,0,0,0,52.07-10.83l22,24.21a8,8,0,1,0,11.84-10.76Zm47.33,75.84,41.67,45.85a32,32,0,0,1-41.67-45.85ZM128,192c-30.78,0-57.67-11.19-79.93-33.25A133.16,133.16,0,0,1,25,128c4.69-8.79,19.66-33.39,47.35-49.38l18,19.75a48,48,0,0,0,63.66,70l14.73,16.2A112,112,0,0,1,128,192Zm6-95.43a8,8,0,0,1,3-15.72,48.16,48.16,0,0,1,38.77,42.64,8,8,0,0,1-7.22,8.71,6.39,6.39,0,0,1-.75,0,8,8,0,0,1-8-7.26A32.09,32.09,0,0,0,134,96.57Zm113.28,34.69c-.42.94-10.55,23.37-33.36,43.8a8,8,0,1,1-10.67-11.92A132.77,132.77,0,0,0,231.05,128a133.15,133.15,0,0,0-23.12-30.77C185.67,75.19,158.78,64,128,64a118.37,118.37,0,0,0-19.36,1.57A8,8,0,1,1,106,49.79,134,134,0,0,1,128,48c34.88,0,66.57,13.26,91.66,38.35,18.83,18.83,27.3,37.62,27.65,38.41A8,8,0,0,1,247.31,131.26Z"/></svg>', or = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M232,64H208V48a8,8,0,0,0-8-8H56a8,8,0,0,0-8,8V64H24A16,16,0,0,0,8,80V96a40,40,0,0,0,40,40h3.65A80.13,80.13,0,0,0,120,191.61V216H96a8,8,0,0,0,0,16h64a8,8,0,0,0,0-16H136V191.58c31.94-3.23,58.44-25.64,68.08-55.58H208a40,40,0,0,0,40-40V80A16,16,0,0,0,232,64ZM48,120A24,24,0,0,1,24,96V80H48v32q0,4,.39,8Zm144-8.9c0,35.52-29,64.64-64,64.9a64,64,0,0,1-64-64V56H192ZM232,96a24,24,0,0,1-24,24h-.5a81.81,81.81,0,0,0,.5-8.9V80h24Z"/></svg>', sr = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M232,64H208V48a8,8,0,0,0-8-8H56a8,8,0,0,0-8,8V64H24A16,16,0,0,0,8,80V96a40,40,0,0,0,40,40h3.65A80.13,80.13,0,0,0,120,191.61V216H96a8,8,0,0,0,0,16h64a8,8,0,0,0,0-16H136V191.58c31.94-3.23,58.44-25.64,68.08-55.58H208a40,40,0,0,0,40-40V80A16,16,0,0,0,232,64ZM48,120A24,24,0,0,1,24,96V80H48v32q0,4,.39,8ZM232,96a24,24,0,0,1-24,24h-.5a81.81,81.81,0,0,0,.5-8.9V80h24Z"/></svg>', nr = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M240,200h-8V144a16,16,0,0,0-16-16H176V56a16,16,0,0,0-16-16H96A16,16,0,0,0,80,56V88H40a16,16,0,0,0-16,16v96H16a8,8,0,0,0,0,16H240a8,8,0,0,0,0-16ZM80,200H40V104H80Zm60-64a8,8,0,0,1-16,0V107.1l-1.47.49a8,8,0,0,1-5.06-15.18l12-4A8,8,0,0,1,140,96Zm76,64H176V144h40Z"/></svg>', cr = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M212.92,17.69a8,8,0,0,0-6.86-1.45l-128,32A8,8,0,0,0,72,56V166.08A36,36,0,1,0,88,196V110.25l112-28v51.83A36,36,0,1,0,216,164V24A8,8,0,0,0,212.92,17.69ZM52,216a20,20,0,1,1,20-20A20,20,0,0,1,52,216ZM88,93.75V62.25l112-28v31.5ZM180,184a20,20,0,1,1,20-20A20,20,0,0,1,180,184Z"/></svg>', ur = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M212.92,17.71a7.89,7.89,0,0,0-6.86-1.46l-128,32A8,8,0,0,0,72,56V166.1A36,36,0,1,0,88,196V102.25l112-28V134.1A36,36,0,1,0,216,164V24A8,8,0,0,0,212.92,17.71Z"/></svg>', vr = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M232.4,114.49,88.32,26.35a16,16,0,0,0-16.2-.3A15.86,15.86,0,0,0,64,39.87V216.13A15.94,15.94,0,0,0,80,232a16.07,16.07,0,0,0,8.36-2.35L232.4,141.51a15.81,15.81,0,0,0,0-27ZM80,215.94V40l143.83,88Z"/></svg>', gr = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M200,32H160a16,16,0,0,0-16,16V208a16,16,0,0,0,16,16h40a16,16,0,0,0,16-16V48A16,16,0,0,0,200,32Zm0,176H160V48h40ZM96,32H56A16,16,0,0,0,40,48V208a16,16,0,0,0,16,16H96a16,16,0,0,0,16-16V48A16,16,0,0,0,96,32Zm0,176H56V48H96Z"/></svg>', dr = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M199.81,34a16,16,0,0,0-16.24.43L64,109.23V40a8,8,0,0,0-16,0V216a8,8,0,0,0,16,0V146.77l119.57,74.78A15.95,15.95,0,0,0,208,208.12V47.88A15.86,15.86,0,0,0,199.81,34ZM192,208,64.16,128,192,48.07Z"/></svg>', pr = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M200,32a8,8,0,0,0-8,8v69.23L72.43,34.45A15.95,15.95,0,0,0,48,47.88V208.12a16,16,0,0,0,24.43,13.43L192,146.77V216a8,8,0,0,0,16,0V40A8,8,0,0,0,200,32ZM64,207.93V48.05l127.84,80Z"/></svg>', fr = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M240,128a15.74,15.74,0,0,1-7.6,13.51L88.32,229.65a16,16,0,0,1-16.2.3A15.86,15.86,0,0,1,64,216.13V39.87a15.86,15.86,0,0,1,8.12-13.82,16,16,0,0,1,16.2.3L232.4,114.49A15.74,15.74,0,0,1,240,128Z"/></svg>', br = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M216,48V208a16,16,0,0,1-16,16H160a16,16,0,0,1-16-16V48a16,16,0,0,1,16-16h40A16,16,0,0,1,216,48ZM96,32H56A16,16,0,0,0,40,48V208a16,16,0,0,0,16,16H96a16,16,0,0,0,16-16V48A16,16,0,0,0,96,32Z"/></svg>', wr = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M208,47.88V208.12a16,16,0,0,1-24.43,13.43L64,146.77V216a8,8,0,0,1-16,0V40a8,8,0,0,1,16,0v69.23L183.57,34.45A15.95,15.95,0,0,1,208,47.88Z"/></svg>', hr = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M208,40V216a8,8,0,0,1-16,0V146.77L72.43,221.55A15.95,15.95,0,0,1,48,208.12V47.88A15.95,15.95,0,0,1,72.43,34.45L192,109.23V40a8,8,0,0,1,16,0Z"/></svg>', mr = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M24,128A72.08,72.08,0,0,1,96,56H204.69L194.34,45.66a8,8,0,0,1,11.32-11.32l24,24a8,8,0,0,1,0,11.32l-24,24a8,8,0,0,1-11.32-11.32L204.69,72H96a56.06,56.06,0,0,0-56,56,8,8,0,0,1-16,0Zm200-8a8,8,0,0,0-8,8,56.06,56.06,0,0,1-56,56H51.31l10.35-10.34a8,8,0,0,0-11.32-11.32l-24,24a8,8,0,0,0,0,11.32l24,24a8,8,0,0,0,11.32-11.32L51.31,200H160a72.08,72.08,0,0,0,72-72A8,8,0,0,0,224,120Z"/></svg>', _r = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M24,128A72.08,72.08,0,0,1,96,56H204.69L194.34,45.66a8,8,0,0,1,11.32-11.32l24,24a8,8,0,0,1,0,11.32l-24,24a8,8,0,0,1-11.32-11.32L204.69,72H96a56.06,56.06,0,0,0-56,56,8,8,0,0,1-16,0Zm200-8a8,8,0,0,0-8,8,56.06,56.06,0,0,1-56,56H51.31l10.35-10.34a8,8,0,0,0-11.32-11.32l-24,24a8,8,0,0,0,0,11.32l24,24a8,8,0,0,0,11.32-11.32L51.31,200H160a72.08,72.08,0,0,0,72-72A8,8,0,0,0,224,120Zm-88,40a8,8,0,0,0,8-8V104a8,8,0,0,0-11.58-7.16l-16,8a8,8,0,1,0,7.16,14.31l4.42-2.21V152A8,8,0,0,0,136,160Z"/></svg>', xr = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M237.66,178.34a8,8,0,0,1,0,11.32l-24,24a8,8,0,0,1-11.32-11.32L212.69,192H200.94a72.12,72.12,0,0,1-58.59-30.15l-41.72-58.4A56.1,56.1,0,0,0,55.06,80H32a8,8,0,0,1,0-16H55.06a72.12,72.12,0,0,1,58.59,30.15l41.72,58.4A56.1,56.1,0,0,0,200.94,176h11.75l-10.35-10.34a8,8,0,0,1,11.32-11.32ZM143,107a8,8,0,0,0,11.16-1.86l1.2-1.67A56.1,56.1,0,0,1,200.94,80h11.75L202.34,90.34a8,8,0,0,0,11.32,11.32l24-24a8,8,0,0,0,0-11.32l-24-24a8,8,0,0,0-11.32,11.32L212.69,64H200.94a72.12,72.12,0,0,0-58.59,30.15l-1.2,1.67A8,8,0,0,0,143,107Zm-30,42a8,8,0,0,0-11.16,1.86l-1.2,1.67A56.1,56.1,0,0,1,55.06,176H32a8,8,0,0,0,0,16H55.06a72.12,72.12,0,0,0,58.59-30.15l1.2-1.67A8,8,0,0,0,113,149Z"/></svg>', Ar = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M32,64a8,8,0,0,1,8-8H216a8,8,0,0,1,0,16H40A8,8,0,0,1,32,64Zm8,72H160a8,8,0,0,0,0-16H40a8,8,0,0,0,0,16Zm72,48H40a8,8,0,0,0,0,16h72a8,8,0,0,0,0-16Zm135.66-57.7a8,8,0,0,1-10,5.36L208,122.75V192a32.05,32.05,0,1,1-16-27.69V112a8,8,0,0,1,10.3-7.66l40,12A8,8,0,0,1,247.66,126.3ZM192,192a16,16,0,1,0-16,16A16,16,0,0,0,192,192Z"/></svg>', yr = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M208,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM64,72H192a8,8,0,0,1,0,16H64a8,8,0,0,1,0-16Zm0,48h72a8,8,0,0,1,0,16H64a8,8,0,0,1,0-16Zm40,64H64a8,8,0,0,1,0-16h40a8,8,0,0,1,0,16Zm103.59-53.47a8,8,0,0,1-10.12,5.06L184,131.1V176a24,24,0,1,1-16-22.62V120a8,8,0,0,1,10.53-7.59l24,8A8,8,0,0,1,207.59,130.53Z"/></svg>', Zr = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M155.51,24.81a8,8,0,0,0-8.42.88L77.25,80H32A16,16,0,0,0,16,96v64a16,16,0,0,0,16,16H77.25l69.84,54.31A8,8,0,0,0,160,224V32A8,8,0,0,0,155.51,24.81ZM32,96H72v64H32ZM144,207.64,88,164.09V91.91l56-43.55Zm54-106.08a40,40,0,0,1,0,52.88,8,8,0,0,1-12-10.58,24,24,0,0,0,0-31.72,8,8,0,0,1,12-10.58ZM248,128a79.9,79.9,0,0,1-20.37,53.34,8,8,0,0,1-11.92-10.67,64,64,0,0,0,0-85.33,8,8,0,1,1,11.92-10.67A79.83,79.83,0,0,1,248,128Z"/></svg>', Vr = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M155.51,24.81a8,8,0,0,0-8.42.88L77.25,80H32A16,16,0,0,0,16,96v64a16,16,0,0,0,16,16H77.25l69.84,54.31A8,8,0,0,0,160,224V32A8,8,0,0,0,155.51,24.81ZM32,96H72v64H32ZM144,207.64,88,164.09V91.91l56-43.55Zm101.66-61.3a8,8,0,0,1-11.32,11.32L216,139.31l-18.34,18.35a8,8,0,0,1-11.32-11.32L204.69,128l-18.35-18.34a8,8,0,0,1,11.32-11.32L216,116.69l18.34-18.35a8,8,0,0,1,11.32,11.32L227.31,128Z"/></svg>', Hr = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M160,32.25V223.69a8.29,8.29,0,0,1-3.91,7.18,8,8,0,0,1-9-.56l-65.57-51A4,4,0,0,1,80,176.16V79.84a4,4,0,0,1,1.55-3.15l65.57-51a8,8,0,0,1,10,.16A8.27,8.27,0,0,1,160,32.25ZM60,80H32A16,16,0,0,0,16,96v64a16,16,0,0,0,16,16H60a4,4,0,0,0,4-4V84A4,4,0,0,0,60,80Zm126.77,20.84a8,8,0,0,0-.72,11.3,24,24,0,0,1,0,31.72,8,8,0,1,0,12,10.58,40,40,0,0,0,0-52.88A8,8,0,0,0,186.74,100.84Zm40.89-26.17a8,8,0,1,0-11.92,10.66,64,64,0,0,1,0,85.34,8,8,0,1,0,11.92,10.66,80,80,0,0,0,0-106.66Z"/></svg>', Cr = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M245.66,146.34a8,8,0,0,1-11.32,11.32L216,139.31l-18.34,18.35a8,8,0,0,1-11.32-11.32L204.69,128l-18.35-18.34a8,8,0,0,1,11.32-11.32L216,116.69l18.34-18.35a8,8,0,0,1,11.32,11.32L227.31,128ZM60,80H32A16,16,0,0,0,16,96v64a16,16,0,0,0,16,16H60a4,4,0,0,0,4-4V84A4,4,0,0,0,60,80Zm97.15-54.15a8,8,0,0,0-10-.16l-65.57,51A4,4,0,0,0,80,79.84v96.32a4,4,0,0,0,1.55,3.15l65.57,51a8,8,0,0,0,9,.56,8.29,8.29,0,0,0,3.91-7.18V32.25A8.27,8.27,0,0,0,157.12,25.85Z"/></svg>', Mr = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M141.66,133.66l-40,40a8,8,0,0,1-11.32-11.32L116.69,136H24a8,8,0,0,1,0-16h92.69L90.34,93.66a8,8,0,0,1,11.32-11.32l40,40A8,8,0,0,1,141.66,133.66ZM200,32H136a8,8,0,0,0,0,16h56V208H136a8,8,0,0,0,0,16h64a8,8,0,0,0,8-8V40A8,8,0,0,0,200,32Z"/></svg>', kr = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M120,216a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V40a8,8,0,0,1,8-8h64a8,8,0,0,1,0,16H56V208h56A8,8,0,0,1,120,216Zm109.66-93.66-40-40a8,8,0,0,0-11.32,11.32L204.69,120H112a8,8,0,0,0,0,16h92.69l-26.35,26.34a8,8,0,0,0,11.32,11.32l40-40A8,8,0,0,0,229.66,122.34Z"/></svg>', Lr = {
  home: ee,
  launcher: re,
  playtime: ie,
  chartLine: te,
  screenshots: ae,
  games: le,
  addGame: oe,
  steam: se,
  steamLogo: ne,
  steamLogin: ce,
  steamAccounts: ue,
  steamInventory: ve,
  authenticator: $0,
  cloud: ge,
  downloadPage: I0,
  settings: de,
  about: W0,
  info: W0,
  fullscreen: pe,
  list: fe,
  grid: be,
  pin: ze,
  folder: we,
  reset: he,
  upload: Ke,
  warning: me,
  key: $0,
  starFilled: U0,
  starOutline: U0,
  chevronDown: _e,
  download: I0,
  angleUp: xe,
  caretRight: Ae,
  image: ye,
  imageBroken: Ze,
  arrowLeft: Ve,
  arrowRight: He,
  search: Ce,
  searchFilled: Me,
  copy: ke,
  edit: Le,
  trash: Ee,
  cloudDownload: Re,
  cloudUpload: Se,
  drive: Be,
  user: Pe,
  globe: Oe,
  externalLink: je,
  monitor: Te,
  chart: Fe,
  ranking: De,
  clock: Ne,
  success: Ie,
  error: $e,
  question: We,
  close: Ue,
  check: Ye,
  theme: qe,
  themeAlt: Ge,
  bell: Qe,
  archive: Je,
  save: Xe,
  eye: ar,
  eyeSlash: lr,
  heart: er,
  heartFilled: rr,
  bookmark: ir,
  bookmarkFilled: tr,
  trophy: or,
  trophyFill: sr,
  rankingFilled: nr,
  music: cr,
  musicFilled: ur,
  play: vr,
  pause: gr,
  skipBack: dr,
  skipForward: pr,
  playFilled: fr,
  pauseFilled: br,
  skipBackFilled: wr,
  skipForwardFilled: hr,
  repeat: mr,
  repeatOnce: _r,
  shuffle: xr,
  playlist: Ar,
  playlistFilled: yr,
  speaker: Zr,
  speakerMute: Vr,
  speakerFilled: Hr,
  speakerMuteFilled: Cr,
  signIn: Mr,
  signOut: kr
};
function z0({ name: t, className: o = "", size: n = 20, title: i }) {
  const l = Lr[t], r = {
    width: typeof n == "number" ? `${n}px` : n,
    height: typeof n == "number" ? `${n}px` : n
  };
  return /* @__PURE__ */ w.jsx(
    "span",
    {
      className: [
        "inline-flex shrink-0 items-center justify-center leading-none",
        "[&_svg]:block [&_svg]:h-full [&_svg]:w-full [&_svg]:fill-current [&_svg]:stroke-current",
        o
      ].join(" "),
      style: r,
      role: i ? "img" : void 0,
      "aria-hidden": i ? void 0 : !0,
      "aria-label": i,
      dangerouslySetInnerHTML: { __html: l }
    }
  );
}
const Er = "app-surface app-glass-floating", Rr = "app-surface app-glass-control", Sr = "app-surface app-glass-floating", Br = "app-glass-menu-item";
function K0(t) {
  return t.filter(Boolean).join(" ");
}
const Pr = Er, Q0 = Rr, Or = Sr, jr = Br;
function Tr({ className: t = "", children: o, ...n }) {
  return /* @__PURE__ */ w.jsx("div", { className: K0([Pr, t]), ...n, children: o });
}
const Fr = q0(function({ className: o = "", children: n, ...i }, l) {
  return /* @__PURE__ */ w.jsx("div", { ref: l, className: K0([Or, o]), ...i, children: n });
});
function qr({
  open: t,
  onClose: o,
  title: n,
  children: i,
  actions: l,
  className: r = "",
  size: s = "md"
}) {
  const [p, m] = z(!1), [H, A] = z(!1), h = c0(null);
  u0(() => {
    if (t)
      A(!0), m(!1);
    else if (H) {
      m(!0);
      const L = setTimeout(() => A(!1), 180);
      return () => clearTimeout(L);
    }
  }, [t]);
  const C = G0(() => {
    m(!0), setTimeout(() => o(), 150);
  }, [o]);
  if (!H) return null;
  t && (h.current = { title: n, children: i, actions: l });
  const k = h.current ?? { title: n, children: i, actions: l }, N = s === "lg" ? "w-[min(92vw,680px)] max-h-[85vh]" : "w-[300px]", J = /* @__PURE__ */ w.jsx(
    "div",
    {
      className: `fixed inset-0 z-50 flex items-center justify-center soft-backdrop ${p ? "animate-fade-out" : "animate-fade-in"}`,
      onClick: (L) => {
        L.target === L.currentTarget && C();
      },
      children: /* @__PURE__ */ w.jsxs(
        Tr,
        {
          className: `relative ${N} rounded-[20px] shadow-[20px_20px_30px_rgba(0,0,0,0.068)] flex flex-col items-center gap-5 p-[30px] ${p ? "animate-fade-out" : "animate-scale-in"} ${r}`,
          onClick: (L) => L.stopPropagation(),
          children: [
            /* @__PURE__ */ w.jsx(
              "button",
              {
                onClick: C,
                className: "absolute top-5 right-5 flex items-center justify-center border-none bg-transparent cursor-pointer group",
                children: /* @__PURE__ */ w.jsx(z0, { name: "close", size: 20, className: "text-[#afafaf] group-hover:text-black dark:group-hover:text-white transition-colors" })
              }
            ),
            /* @__PURE__ */ w.jsxs("div", { className: `w-full flex flex-col gap-[5px] ${s === "lg" ? "min-h-0 overflow-y-auto" : ""}`, children: [
              k.title && /* @__PURE__ */ w.jsx("p", { className: "text-[20px] font-bold text-[rgb(27,27,27)] dark:text-foreground", children: k.title }),
              /* @__PURE__ */ w.jsx("div", { className: "font-light text-[rgb(102,102,102)] dark:text-muted-foreground", children: k.children })
            ] }),
            k.actions && /* @__PURE__ */ w.jsx("div", { className: "w-full flex items-center justify-center gap-[10px]", children: k.actions })
          ]
        }
      )
    }
  );
  return T1(J, document.body);
}
function Gr({
  options: t,
  value: o,
  onChange: n,
  name: i,
  className: l = ""
}) {
  var H, A;
  const [r, s] = z(!1), p = c0(null), m = ((H = t.find((h) => h.value === o)) == null ? void 0 : H.label) || ((A = t[0]) == null ? void 0 : A.label) || "";
  return u0(() => {
    if (!r) return;
    const h = (C) => {
      p.current && !p.current.contains(C.target) && s(!1);
    };
    return document.addEventListener("mousedown", h), () => document.removeEventListener("mousedown", h);
  }, [r]), /* @__PURE__ */ w.jsxs("div", { ref: p, className: `relative z-[100] select-none w-fit ${l}`.trim(), children: [
    /* @__PURE__ */ w.jsxs(
      "div",
      {
        onClick: () => s(!r),
        "data-open": r ? "true" : "false",
        className: `${Q0} flex items-center justify-between gap-2 border border-foreground/20 px-3 py-[5px] rounded text-xs cursor-pointer min-w-[100px] text-foreground`,
        children: [
          /* @__PURE__ */ w.jsx("span", { children: m }),
          /* @__PURE__ */ w.jsx(
            z0,
            {
              name: "chevronDown",
              size: 12,
              className: `text-foreground transition-transform duration-300 ${r ? "rotate-180" : ""}`
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ w.jsx(
      Fr,
      {
        className: [
          "absolute top-full mt-1 w-full flex flex-col gap-0.5 rounded border border-foreground/10 p-1 shadow-lg z-[110]",
          // 选项过多时限制高度并滚动（约 10 行），避免撑开页面滚动区域
          "max-h-[286px] overflow-y-auto",
          "transition-all duration-300 ease-out",
          r ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-1 pointer-events-none"
        ].join(" "),
        children: t.map((h) => /* @__PURE__ */ w.jsx(
          "button",
          {
            onClick: () => {
              n(h.value), s(!1);
            },
            className: [
              `${jr} text-left rounded px-3 py-[5px] text-xs transition-colors duration-300`,
              "text-foreground hover:bg-secondary",
              o === h.value ? "bg-secondary font-medium" : ""
            ].join(" "),
            children: h.label
          },
          h.value
        ))
      }
    )
  ] });
}
function zr({
  min: t,
  max: o,
  step: n = 1,
  value: i,
  onChange: l,
  className: r = ""
}) {
  const s = o === t ? 0 : (i - t) / (o - t) * 100;
  return /* @__PURE__ */ w.jsx(
    "label",
    {
      className: [
        "inline-flex w-full cursor-pointer items-center",
        "[--slider-height:6px] [--slider-fill:hsl(var(--primary))] [--slider-track:hsl(var(--border)/0.88)] [--slider-track-hover:hsl(var(--primary)/0.2)] [--slider-ring:hsl(var(--primary)/0.18)] [--slider-outline:hsl(var(--border)/0.9)]",
        r
      ].join(" "),
      children: /* @__PURE__ */ w.jsx(
        "input",
        {
          type: "range",
          min: t,
          max: o,
          step: n,
          value: i,
          onChange: (p) => l(Number(p.target.value)),
          className: "app-glass-slider slider-level h-[var(--slider-height)] w-full cursor-pointer appearance-none rounded-full bg-[var(--slider-track)] shadow-[inset_0_0_0_1px_var(--slider-outline)] transition-[height,box-shadow,background] duration-150 hover:h-[calc(var(--slider-height)*2)] hover:bg-[var(--slider-track-hover)] hover:shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.32)] focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--slider-ring),inset_0_0_0_1px_hsl(var(--primary)/0.4)] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-0 [&::-webkit-slider-thumb]:h-0 [&::-moz-range-thumb]:w-0 [&::-moz-range-thumb]:h-0 [&::-moz-range-thumb]:border-0",
          style: {
            background: `linear-gradient(to right, var(--slider-fill) 0%, var(--slider-fill) ${s}%, var(--slider-track) ${s}%, var(--slider-track) 100%)`
          }
        }
      )
    }
  );
}
const Kr = q0(
  function({ className: o = "", density: n = "default", ...i }, l) {
    return /* @__PURE__ */ w.jsx(
      "input",
      {
        ref: l,
        className: [
          "w-full rounded border border-border",
          n === "compact" ? "px-2 py-0.5 text-xs" : "px-3 py-2 text-sm",
          "border border-border",
          `${Q0} text-foreground placeholder:text-muted-foreground`,
          "shadow-[0px_0px_14px_-20px] shadow-black/10",
          "transition-[border-color,box-shadow,color] duration-150 ease-out",
          "hover:border-primary/20",
          "focus:outline-none focus:border-primary/35 focus:ring-2 focus:ring-primary/15",
          "disabled:opacity-60 disabled:cursor-not-allowed",
          "read-only:text-muted-foreground read-only:bg-primary/[0.02]",
          o
        ].join(" "),
        ...i
      }
    );
  }
);
function Qr({ on: t, onChange: o, id: n }) {
  const i = n || n0.useId();
  return /* @__PURE__ */ w.jsxs("div", { className: "relative inline-block w-[42px] h-[22px]", children: [
    /* @__PURE__ */ w.jsx(
      "input",
      {
        id: i,
        type: "checkbox",
        checked: t,
        onChange: (l) => o(l.target.checked),
        className: "sr-only"
      }
    ),
    /* @__PURE__ */ w.jsx(
      "label",
      {
        htmlFor: i,
        className: [
          "app-glass-toggle-track absolute inset-0 overflow-hidden rounded-[11px] cursor-pointer transition-all duration-300 border",
          t ? "bg-primary/20 border-primary/30 shadow-[0_0_0_1px_hsl(var(--primary)/0.08)]" : "bg-muted/80 border-border"
        ].join(" "),
        children: /* @__PURE__ */ w.jsx(
          "span",
          {
            className: [
              "app-glass-toggle-thumb absolute left-[2px] top-[1px] w-[18px] h-[18px] rounded-full shadow-md transition-all duration-300 border",
              t ? "translate-x-[20px] bg-primary border-primary/70" : "translate-x-0 bg-background border-foreground/12"
            ].join(" ")
          }
        )
      }
    )
  ] });
}
const Jr = {
  createElement: j1,
  Fragment: O1,
  useCallback: G0,
  useContext: P1,
  useEffect: u0,
  useRef: c0,
  useState: z
}, Dr = 1, Xr = ["core.read", "core.backup", "events", "ui", "music", "bilibili"];
class Y0 extends Error {
  constructor(n) {
    super(n.message);
    Y(this, "kind");
    Y(this, "retryable");
    Y(this, "externalUrl");
    this.name = "BiliSdkError", this.kind = n.kind, this.retryable = n.retryable, this.externalUrl = n.externalUrl;
  }
}
const q = [], G = [], Q = /* @__PURE__ */ new Map();
function e8(t) {
  for (let o = q.length - 1; o >= 0; o--)
    q[o].pluginId === t && q.splice(o, 1);
  for (let o = G.length - 1; o >= 0; o--)
    G[o].pluginId === t && G.splice(o, 1);
}
async function r8(t) {
  const o = Q.get(t) ?? [], n = [];
  for (const i of o)
    try {
      await i();
    } catch (l) {
      n.push(l);
    }
  return n;
}
function i8(t) {
  Q.delete(t);
}
function t8(t, o) {
  const n = new Set(o);
  function i(r, s) {
    if (!n.has(r))
      throw new Error(
        `PermissionDenied: plugin "${t}" lacks permission "${r}" (${s})`
      );
  }
  function l(r, s) {
    return v(r, s).catch((p) => {
      throw Nr(p);
    });
  }
  return {
    apiVersion: Dr,
    log: (...r) => console.log(`[plugin:${t}]`, ...r),
    ui: {
      registerPage(r) {
        i("ui", "ui.registerPage"), q.push({ pluginId: t, ...r });
      },
      registerSettingsSection(r) {
        i("ui", "ui.registerSettingsSection"), G.push({ pluginId: t, ...r });
      },
      notify(r) {
        i("ui", "ui.notify");
      }
    },
    core: {
      listGames() {
        return i("core.read", "core.listGames"), v("get_games");
      },
      listSnapshots(r) {
        return i("core.read", "core.listSnapshots"), v("get_snapshots", { gameId: r });
      },
      getGame(r) {
        return i("core.read", "core.getGame"), v("get_game_by_id", { gameId: r });
      },
      triggerBackup(r) {
        return i("core.backup", "core.triggerBackup"), v("backup_now", { gameId: r });
      }
    },
    events: {
      on(r, s) {
        i("events", "events.on"), q1(t, r, s);
      },
      off(r, s) {
        i("events", "events.off"), Y1(r, s);
      }
    },
    storage: {
      get() {
        return v("read_plugin_config", { id: t });
      },
      set(r) {
        return v("write_plugin_config", { id: t, data: r });
      }
    },
    lifecycle: {
      onDispose(r) {
        const s = Q.get(t) ?? [];
        s.push(r), Q.set(t, s);
      }
    },
    music: {
      openLoginWindow() {
        return i("music", "music.openLoginWindow"), v("music_open_login_window");
      },
      loginQrKey() {
        return i("music", "music.loginQrKey"), v("music_login_qr_key");
      },
      loginQrCheck(r) {
        return i("music", "music.loginQrCheck"), v("music_login_qr_check", { key: r });
      },
      sendLoginCaptcha(r, s) {
        return i("music", "music.sendLoginCaptcha"), v("music_login_send_captcha", { phone: r, countrycode: s });
      },
      loginCellphone(r, s, p) {
        return i("music", "music.loginCellphone"), v("music_login_cellphone", { phone: r, captcha: s, countrycode: p });
      },
      loginStatus() {
        return i("music", "music.loginStatus"), v("music_login_status");
      },
      logout() {
        return i("music", "music.logout"), v("music_logout");
      },
      search(r, s) {
        return i("music", "music.search"), v("music_search", { keywords: r, limit: s });
      },
      userPlaylists() {
        return i("music", "music.userPlaylists"), v("music_user_playlists");
      },
      likedList() {
        return i("music", "music.likedList"), v("music_likelist");
      },
      likeSong(r, s) {
        return i("music", "music.likeSong"), v("music_like", { id: r, like: s });
      },
      subscribePlaylist(r, s) {
        return i("music", "music.subscribePlaylist"), v("music_playlist_subscribe", { id: r, subscribe: s });
      },
      recommendSongs() {
        return i("music", "music.recommendSongs"), v("music_recommend_songs");
      },
      topPlaylists() {
        return i("music", "music.topPlaylists"), v("music_toplists");
      },
      personalizedPlaylists() {
        return i("music", "music.personalizedPlaylists"), v("music_personalized_playlists");
      },
      searchPlaylists(r, s) {
        return i("music", "music.searchPlaylists"), v("music_playlist_search", { keywords: r, limit: s });
      },
      searchAlbums(r, s) {
        return i("music", "music.searchAlbums"), v("music_album_search", { keywords: r, limit: s });
      },
      searchArtists(r, s) {
        return i("music", "music.searchArtists"), v("music_artist_search", { keywords: r, limit: s });
      },
      albumSongs(r) {
        return i("music", "music.albumSongs"), v("music_album_songs", { id: r });
      },
      artistSongs(r) {
        return i("music", "music.artistSongs"), v("music_artist_songs", { id: r });
      },
      playlistTracks(r) {
        return i("music", "music.playlistTracks"), v("music_playlist_tracks", { id: r });
      },
      playlistTracksRange(r, s, p) {
        return i("music", "music.playlistTracksRange"), v("music_playlist_tracks_range", { id: r, start: s, count: p });
      },
      songUrl(r, s) {
        return i("music", "music.songUrl"), v("music_song_url", s ? { id: r, quality: s } : { id: r });
      },
      lyric(r) {
        return i("music", "music.lyric"), v("music_lyric", { id: r });
      },
      proxyPort() {
        return i("music", "music.proxyPort"), v("music_proxy_port");
      },
      async audioProxyUrl(r) {
        return i("music", "music.audioProxyUrl"), `http://127.0.0.1:${await v("music_proxy_port")}/audio?url=${encodeURIComponent(r)}`;
      },
      async coverProxyUrl(r) {
        return i("music", "music.coverProxyUrl"), r ? `http://127.0.0.1:${await v("music_proxy_port")}/cover?url=${encodeURIComponent(r)}` : "";
      },
      clearCoverCache() {
        return i("music", "music.clearCoverCache"), v("music_clear_cover_cache");
      }
    },
    bilibili: {
      account: {
        loginQrKey() {
          return i("bilibili", "bilibili.account.loginQrKey"), l("bilibili_login_qr_key");
        },
        loginQrCheck(r) {
          return i("bilibili", "bilibili.account.loginQrCheck"), l("bilibili_login_qr_check", { key: r });
        },
        loginStatus() {
          return i("bilibili", "bilibili.account.loginStatus"), l("bilibili_login_status");
        },
        logout() {
          return i("bilibili", "bilibili.account.logout"), l("bilibili_logout");
        }
      },
      home: {
        recommendVideos(r, s) {
          return i("bilibili", "bilibili.home.recommendVideos"), l("bilibili_recommend_videos", { page: r, refresh: s });
        },
        searchVideos(r, s, p) {
          return i("bilibili", "bilibili.home.searchVideos"), l("bilibili_search_videos", { keywords: r, page: s, refresh: p });
        },
        popularVideos(r, s) {
          return i("bilibili", "bilibili.home.popularVideos"), l("bilibili_popular_videos", { page: r, refresh: s });
        }
      },
      video: {
        detail(r) {
          return i("bilibili", "bilibili.video.detail"), l("bilibili_video_detail", r);
        },
        related(r) {
          return i("bilibili", "bilibili.video.related"), l("bilibili_related_videos", r);
        },
        openExternal(r) {
          return i("bilibili", "bilibili.video.openExternal"), l("bilibili_open_video", { bvid: r });
        }
      },
      playback: {
        proxyPort() {
          return i("bilibili", "bilibili.playback.proxyPort"), l("bilibili_proxy_port");
        },
        createPlayback(r) {
          return i("bilibili", "bilibili.playback.createPlayback"), l("bilibili_create_playback", r);
        },
        saveLocalProgress(r) {
          return i("bilibili", "bilibili.playback.saveLocalProgress"), l("bilibili_save_local_progress", r);
        },
        loadLocalProgress(r) {
          return i("bilibili", "bilibili.playback.loadLocalProgress"), l("bilibili_load_local_progress", r);
        },
        reportProgress(r) {
          return i("bilibili", "bilibili.playback.reportProgress"), l("bilibili_report_progress", r);
        }
      },
      danmaku: {
        list(r) {
          return i("bilibili", "bilibili.danmaku.list"), l("bilibili_danmaku_list", r);
        },
        send(r) {
          return i("bilibili", "bilibili.danmaku.send"), l("bilibili_send_danmaku", r);
        }
      },
      comment: {
        list(r) {
          return i("bilibili", "bilibili.comment.list"), l("bilibili_comment_list", r);
        },
        replies(r) {
          return i("bilibili", "bilibili.comment.replies"), l("bilibili_comment_replies", r);
        },
        add(r) {
          return i("bilibili", "bilibili.comment.add"), l("bilibili_comment_add", r);
        },
        like(r) {
          return i("bilibili", "bilibili.comment.like"), l("bilibili_comment_like", r);
        },
        dislike(r) {
          return i("bilibili", "bilibili.comment.dislike"), l("bilibili_comment_dislike", r);
        },
        delete(r) {
          return i("bilibili", "bilibili.comment.delete"), l("bilibili_comment_delete", r);
        },
        top(r) {
          return i("bilibili", "bilibili.comment.top"), l("bilibili_comment_top", r);
        },
        report(r) {
          return i("bilibili", "bilibili.comment.report"), l("bilibili_comment_report", r);
        }
      },
      library: {
        historyList(r) {
          return i("bilibili", "bilibili.library.historyList"), l("bilibili_history_list", { page: r });
        },
        toViewList() {
          return i("bilibili", "bilibili.library.toViewList"), l("bilibili_toview_list");
        },
        addToView(r) {
          return i("bilibili", "bilibili.library.addToView"), l("bilibili_toview_add", r);
        },
        removeToView(r) {
          return i("bilibili", "bilibili.library.removeToView"), l("bilibili_toview_remove", r);
        },
        favoriteFolders(r) {
          return i("bilibili", "bilibili.library.favoriteFolders"), l("bilibili_favorite_folders", { rid: r });
        },
        favoriteItems(r, s) {
          return i("bilibili", "bilibili.library.favoriteItems"), l("bilibili_favorite_items", { mediaId: r, page: s });
        },
        favoriteVideo(r) {
          return i("bilibili", "bilibili.library.favoriteVideo"), l("bilibili_favorite_video", {
            rid: r.rid,
            addMediaIds: r.addMediaIds ?? [],
            delMediaIds: r.delMediaIds ?? []
          });
        }
      },
      interaction: {
        state(r) {
          return i("bilibili", "bilibili.interaction.state"), l("bilibili_interaction_state", r);
        },
        like(r) {
          return i("bilibili", "bilibili.interaction.like"), l("bilibili_like_video", r);
        },
        coin(r) {
          return i("bilibili", "bilibili.interaction.coin"), l("bilibili_coin_video", r);
        },
        favorite(r) {
          return i("bilibili", "bilibili.interaction.favorite"), l("bilibili_favorite_video_interaction", {
            rid: r.rid,
            addMediaIds: r.addMediaIds ?? [],
            delMediaIds: r.delMediaIds ?? []
          });
        },
        toView(r) {
          return i("bilibili", "bilibili.interaction.toView"), l("bilibili_toview_video_interaction", r);
        },
        followOwner(r) {
          return i("bilibili", "bilibili.interaction.followOwner"), l("bilibili_follow_owner", r);
        },
        copyShareLink(r) {
          return i("bilibili", "bilibili.interaction.copyShareLink"), l("bilibili_copy_share_link", r);
        },
        openReport(r) {
          return i("bilibili", "bilibili.interaction.openReport"), l("bilibili_open_report", r);
        }
      },
      cache: {
        saveScreenshot(r) {
          return i("bilibili", "bilibili.cache.saveScreenshot"), l("bilibili_save_screenshot", r);
        },
        openScreenshotFolder() {
          return i("bilibili", "bilibili.cache.openScreenshotFolder"), l("bilibili_open_screenshot_folder");
        },
        clearCache() {
          return i("bilibili", "bilibili.cache.clearCache"), l("bilibili_clear_cache");
        },
        async coverProxyUrl(r) {
          return i("bilibili", "bilibili.cache.coverProxyUrl"), r ? `http://127.0.0.1:${await l("bilibili_proxy_port")}/bilibili/cover/${Ir(r)}?url=${encodeURIComponent(r)}` : "";
        }
      },
      ranking: {
        videos(r) {
          return i("bilibili", "bilibili.ranking.videos"), l("bilibili_ranking_videos", { rid: r });
        },
        weeks() {
          return i("bilibili", "bilibili.ranking.weeks"), l("bilibili_weekly_series_list");
        },
        weekDetail(r) {
          return i("bilibili", "bilibili.ranking.weekDetail"), l("bilibili_weekly_series_one", { number: r });
        },
        precious() {
          return i("bilibili", "bilibili.ranking.precious"), l("bilibili_precious_videos");
        }
      },
      search: {
        suggest(r) {
          return i("bilibili", "bilibili.search.suggest"), l("bilibili_search_suggest", { keyword: r });
        },
        hotwords() {
          return i("bilibili", "bilibili.search.hotwords"), l("bilibili_search_hotwords");
        }
      },
      fav: {
        createFolder({ title: r }) {
          return i("bilibili", "bilibili.fav.createFolder"), l("bilibili_fav_folder_create", { title: r });
        },
        editFolder({ mediaId: r, title: s }) {
          return i("bilibili", "bilibili.fav.editFolder"), l("bilibili_fav_folder_edit", { mediaId: r, title: s });
        },
        deleteFolders({ mediaIds: r }) {
          return i("bilibili", "bilibili.fav.deleteFolders"), l("bilibili_fav_folder_delete", { mediaIds: r });
        },
        deleteResources({ mediaId: r, resources: s }) {
          return i("bilibili", "bilibili.fav.deleteResources"), l("bilibili_fav_resource_delete", { mediaId: r, resources: s });
        },
        moveResources({ srcMediaId: r, tarMediaId: s, resources: p }) {
          return i("bilibili", "bilibili.fav.moveResources"), l("bilibili_fav_resource_move", { srcMediaId: r, tarMediaId: s, resources: p });
        },
        copyResources({ srcMediaId: r, tarMediaId: s, resources: p }) {
          return i("bilibili", "bilibili.fav.copyResources"), l("bilibili_fav_resource_copy", { srcMediaId: r, tarMediaId: s, resources: p });
        },
        cleanResources({ mediaId: r }) {
          return i("bilibili", "bilibili.fav.cleanResources"), l("bilibili_fav_resource_clean", { mediaId: r });
        }
      },
      user: {
        space({ mid: r }) {
          return i("bilibili", "bilibili.user.space"), l("bilibili_user_space", { mid: r });
        },
        videos({ mid: r, page: s }) {
          return i("bilibili", "bilibili.user.videos"), l("bilibili_user_videos", { mid: r, page: s });
        },
        follow({ mid: r, follow: s }) {
          return i("bilibili", "bilibili.user.follow"), l("bilibili_user_follow", { mid: r, follow: s });
        }
      },
      season: {},
      live: {},
      dynamic: {},
      message: {},
      note: {},
      article: {}
    }
  };
}
function Nr(t) {
  const o = t instanceof Error ? t.message : String(t);
  try {
    const n = JSON.parse(o);
    if (typeof n.kind == "string" && typeof n.message == "string")
      return new Y0({
        kind: n.kind,
        message: n.message,
        retryable: !!n.retryable,
        externalUrl: typeof n.externalUrl == "string" ? n.externalUrl : void 0
      });
  } catch {
  }
  return new Y0({ kind: "api", message: o, retryable: !1 });
}
function Ir(t) {
  let o = 2166136261;
  for (let n = 0; n < t.length; n += 1)
    o ^= t.charCodeAt(n), o = Math.imul(o, 16777619);
  return `c${(o >>> 0).toString(16)}`;
}
export {
  Xr as ALL_PERMISSIONS,
  Y0 as BiliSdkError,
  Yr as Button,
  qr as Dialog,
  o8 as Fragment,
  z0 as Icon,
  Gr as Select,
  zr as Slider,
  Kr as TextField,
  Qr as Toggle,
  Dr as apiVersion,
  i8 as clearPluginDispose,
  e8 as clearPluginRegistrations,
  s8 as createElement,
  t8 as createPluginSdk,
  Jr as default,
  q as registeredPages,
  G as registeredSettingsSections,
  r8 as runPluginDispose,
  n8 as useCallback,
  c8 as useContext,
  u8 as useEffect,
  v8 as useRef,
  g8 as useState
};
