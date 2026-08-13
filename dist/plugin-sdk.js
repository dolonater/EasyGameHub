var B1 = Object.defineProperty;
var P1 = (t, o, n) => o in t ? B1(t, o, { enumerable: !0, configurable: !0, writable: !0, value: n }) : t[o] = n;
var G = (t, o, n) => P1(t, typeof o != "symbol" ? o + "" : o, n);
import c0, { forwardRef as q0, useState as $, useRef as u0, useEffect as b0, useCallback as G0, useContext as O1, Fragment as j1, createElement as T1 } from "react";
import { Fragment as dr, createElement as vr, useCallback as gr, useContext as pr, useEffect as fr, useRef as mr, useState as wr } from "react";
import { createPortal as z0 } from "react-dom";
import { createPortal as _r } from "react-dom";
function F1(t, o = !1) {
  return window.__TAURI_INTERNALS__.transformCallback(t, o);
}
async function b(t, o = {}, n) {
  return window.__TAURI_INTERNALS__.invoke(t, o, n);
}
var j0;
(function(t) {
  t.WINDOW_RESIZED = "tauri://resize", t.WINDOW_MOVED = "tauri://move", t.WINDOW_CLOSE_REQUESTED = "tauri://close-requested", t.WINDOW_DESTROYED = "tauri://destroyed", t.WINDOW_FOCUS = "tauri://focus", t.WINDOW_BLUR = "tauri://blur", t.WINDOW_SCALE_FACTOR_CHANGED = "tauri://scale-change", t.WINDOW_THEME_CHANGED = "tauri://theme-changed", t.WINDOW_CREATED = "tauri://window-created", t.WINDOW_SUSPENDED = "tauri://suspended", t.WINDOW_RESUMED = "tauri://resumed", t.WEBVIEW_CREATED = "tauri://webview-created", t.DRAG_ENTER = "tauri://drag-enter", t.DRAG_OVER = "tauri://drag-over", t.DRAG_DROP = "tauri://drag-drop", t.DRAG_LEAVE = "tauri://drag-leave";
})(j0 || (j0 = {}));
async function D1(t, o) {
  window.__TAURI_EVENT_PLUGIN_INTERNALS__.unregisterListener(t, o), await b("plugin:event|unlisten", {
    event: t,
    eventId: o
  });
}
async function N1(t, o, n) {
  var r;
  const l = (r = void 0) !== null && r !== void 0 ? r : { kind: "Any" };
  return b("plugin:event|listen", {
    event: t,
    target: l,
    handler: F1(o)
  }).then((i) => async () => D1(t, i));
}
const Q = /* @__PURE__ */ new Map(), T0 = /* @__PURE__ */ new Map(), I1 = ["backup:started", "backup:completed", "backup:failed"];
let F0 = !1;
function $1() {
  if (!F0) {
    F0 = !0;
    for (const t of I1)
      N1(t, (o) => W1(t, o.payload)).catch((o) => {
        console.error(`[plugins:events] failed to listen ${t}:`, o);
      });
  }
}
function W1(t, o) {
  const n = Q.get(t);
  if (n)
    for (const r of Array.from(n))
      try {
        r(o);
      } catch (l) {
        console.error(`[plugins:events] handler for "${t}" threw:`, l);
      }
}
function U1(t, o) {
  let n = Q.get(t);
  n || (n = /* @__PURE__ */ new Set(), Q.set(t, n)), n.add(o);
}
function Y1(t, o) {
  var n;
  (n = Q.get(t)) == null || n.delete(o);
}
function q1(t, o, n) {
  U1(o, n);
  let r = T0.get(t);
  r || (r = [], T0.set(t, r)), r.push({ event: o, handler: n }), $1();
}
var n0 = { exports: {} }, N = {};
/**
 * @license React
 * react-jsx-runtime.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var D0;
function G1() {
  if (D0) return N;
  D0 = 1;
  var t = c0, o = Symbol.for("react.element"), n = Symbol.for("react.fragment"), r = Object.prototype.hasOwnProperty, l = t.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner, i = { key: !0, ref: !0, __self: !0, __source: !0 };
  function s(g, w, L) {
    var A, y = {}, H = null, h = null;
    L !== void 0 && (H = "" + L), w.key !== void 0 && (H = "" + w.key), w.ref !== void 0 && (h = w.ref);
    for (A in w) r.call(w, A) && !i.hasOwnProperty(A) && (y[A] = w[A]);
    if (g && g.defaultProps) for (A in w = g.defaultProps, w) y[A] === void 0 && (y[A] = w[A]);
    return { $$typeof: o, type: g, key: H, ref: h, props: y, _owner: l.current };
  }
  return N.Fragment = n, N.jsx = s, N.jsxs = s, N;
}
var I = {};
/**
 * @license React
 * react-jsx-runtime.development.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var N0;
function z1() {
  return N0 || (N0 = 1, process.env.NODE_ENV !== "production" && function() {
    var t = c0, o = Symbol.for("react.element"), n = Symbol.for("react.portal"), r = Symbol.for("react.fragment"), l = Symbol.for("react.strict_mode"), i = Symbol.for("react.profiler"), s = Symbol.for("react.provider"), g = Symbol.for("react.context"), w = Symbol.for("react.forward_ref"), L = Symbol.for("react.suspense"), A = Symbol.for("react.suspense_list"), y = Symbol.for("react.memo"), H = Symbol.for("react.lazy"), h = Symbol.for("react.offscreen"), S = Symbol.iterator, E = "@@iterator";
    function M(e) {
      if (e === null || typeof e != "object")
        return null;
      var a = S && e[S] || e[E];
      return typeof a == "function" ? a : null;
    }
    var O = t.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
    function Z(e) {
      {
        for (var a = arguments.length, c = new Array(a > 1 ? a - 1 : 0), u = 1; u < a; u++)
          c[u - 1] = arguments[u];
        X0("error", e, c);
      }
    }
    function X0(e, a, c) {
      {
        var u = O.ReactDebugCurrentFrame, p = u.getStackAddendum();
        p !== "" && (a += "%s", c = c.concat([p]));
        var f = c.map(function(v) {
          return String(v);
        });
        f.unshift("Warning: " + a), Function.prototype.apply.call(console[e], console, f);
      }
    }
    var i1 = !1, e1 = !1, r1 = !1, l1 = !1, t1 = !1, d0;
    d0 = Symbol.for("react.module.reference");
    function a1(e) {
      return !!(typeof e == "string" || typeof e == "function" || e === r || e === i || t1 || e === l || e === L || e === A || l1 || e === h || i1 || e1 || r1 || typeof e == "object" && e !== null && (e.$$typeof === H || e.$$typeof === y || e.$$typeof === s || e.$$typeof === g || e.$$typeof === w || // This needs to include all possible module reference object
      // types supported by any Flight configuration anywhere since
      // we don't know which Flight build this will end up being used
      // with.
      e.$$typeof === d0 || e.getModuleId !== void 0));
    }
    function o1(e, a, c) {
      var u = e.displayName;
      if (u)
        return u;
      var p = a.displayName || a.name || "";
      return p !== "" ? c + "(" + p + ")" : c;
    }
    function v0(e) {
      return e.displayName || "Context";
    }
    function R(e) {
      if (e == null)
        return null;
      if (typeof e.tag == "number" && Z("Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue."), typeof e == "function")
        return e.displayName || e.name || null;
      if (typeof e == "string")
        return e;
      switch (e) {
        case r:
          return "Fragment";
        case n:
          return "Portal";
        case i:
          return "Profiler";
        case l:
          return "StrictMode";
        case L:
          return "Suspense";
        case A:
          return "SuspenseList";
      }
      if (typeof e == "object")
        switch (e.$$typeof) {
          case g:
            var a = e;
            return v0(a) + ".Consumer";
          case s:
            var c = e;
            return v0(c._context) + ".Provider";
          case w:
            return o1(e, e.render, "ForwardRef");
          case y:
            var u = e.displayName || null;
            return u !== null ? u : R(e.type) || "Memo";
          case H: {
            var p = e, f = p._payload, v = p._init;
            try {
              return R(v(f));
            } catch {
              return null;
            }
          }
        }
      return null;
    }
    var B = Object.assign, F = 0, g0, p0, f0, m0, w0, h0, _0;
    function x0() {
    }
    x0.__reactDisabledLog = !0;
    function s1() {
      {
        if (F === 0) {
          g0 = console.log, p0 = console.info, f0 = console.warn, m0 = console.error, w0 = console.group, h0 = console.groupCollapsed, _0 = console.groupEnd;
          var e = {
            configurable: !0,
            enumerable: !0,
            value: x0,
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
        F++;
      }
    }
    function n1() {
      {
        if (F--, F === 0) {
          var e = {
            configurable: !0,
            enumerable: !0,
            writable: !0
          };
          Object.defineProperties(console, {
            log: B({}, e, {
              value: g0
            }),
            info: B({}, e, {
              value: p0
            }),
            warn: B({}, e, {
              value: f0
            }),
            error: B({}, e, {
              value: m0
            }),
            group: B({}, e, {
              value: w0
            }),
            groupCollapsed: B({}, e, {
              value: h0
            }),
            groupEnd: B({}, e, {
              value: _0
            })
          });
        }
        F < 0 && Z("disabledDepth fell below zero. This is a bug in React. Please file an issue.");
      }
    }
    var X = O.ReactCurrentDispatcher, i0;
    function W(e, a, c) {
      {
        if (i0 === void 0)
          try {
            throw Error();
          } catch (p) {
            var u = p.stack.trim().match(/\n( *(at )?)/);
            i0 = u && u[1] || "";
          }
        return `
` + i0 + e;
      }
    }
    var e0 = !1, U;
    {
      var c1 = typeof WeakMap == "function" ? WeakMap : Map;
      U = new c1();
    }
    function A0(e, a) {
      if (!e || e0)
        return "";
      {
        var c = U.get(e);
        if (c !== void 0)
          return c;
      }
      var u;
      e0 = !0;
      var p = Error.prepareStackTrace;
      Error.prepareStackTrace = void 0;
      var f;
      f = X.current, X.current = null, s1();
      try {
        if (a) {
          var v = function() {
            throw Error();
          };
          if (Object.defineProperty(v.prototype, "props", {
            set: function() {
              throw Error();
            }
          }), typeof Reflect == "object" && Reflect.construct) {
            try {
              Reflect.construct(v, []);
            } catch (C) {
              u = C;
            }
            Reflect.construct(e, [], v);
          } else {
            try {
              v.call();
            } catch (C) {
              u = C;
            }
            e.call(v.prototype);
          }
        } else {
          try {
            throw Error();
          } catch (C) {
            u = C;
          }
          e();
        }
      } catch (C) {
        if (C && u && typeof C.stack == "string") {
          for (var d = C.stack.split(`
`), V = u.stack.split(`
`), _ = d.length - 1, x = V.length - 1; _ >= 1 && x >= 0 && d[_] !== V[x]; )
            x--;
          for (; _ >= 1 && x >= 0; _--, x--)
            if (d[_] !== V[x]) {
              if (_ !== 1 || x !== 1)
                do
                  if (_--, x--, x < 0 || d[_] !== V[x]) {
                    var k = `
` + d[_].replace(" at new ", " at ");
                    return e.displayName && k.includes("<anonymous>") && (k = k.replace("<anonymous>", e.displayName)), typeof e == "function" && U.set(e, k), k;
                  }
                while (_ >= 1 && x >= 0);
              break;
            }
        }
      } finally {
        e0 = !1, X.current = f, n1(), Error.prepareStackTrace = p;
      }
      var T = e ? e.displayName || e.name : "", P = T ? W(T) : "";
      return typeof e == "function" && U.set(e, P), P;
    }
    function u1(e, a, c) {
      return A0(e, !1);
    }
    function b1(e) {
      var a = e.prototype;
      return !!(a && a.isReactComponent);
    }
    function Y(e, a, c) {
      if (e == null)
        return "";
      if (typeof e == "function")
        return A0(e, b1(e));
      if (typeof e == "string")
        return W(e);
      switch (e) {
        case L:
          return W("Suspense");
        case A:
          return W("SuspenseList");
      }
      if (typeof e == "object")
        switch (e.$$typeof) {
          case w:
            return u1(e.render);
          case y:
            return Y(e.type, a, c);
          case H: {
            var u = e, p = u._payload, f = u._init;
            try {
              return Y(f(p), a, c);
            } catch {
            }
          }
        }
      return "";
    }
    var D = Object.prototype.hasOwnProperty, y0 = {}, Z0 = O.ReactDebugCurrentFrame;
    function q(e) {
      if (e) {
        var a = e._owner, c = Y(e.type, e._source, a ? a.type : null);
        Z0.setExtraStackFrame(c);
      } else
        Z0.setExtraStackFrame(null);
    }
    function d1(e, a, c, u, p) {
      {
        var f = Function.call.bind(D);
        for (var v in e)
          if (f(e, v)) {
            var d = void 0;
            try {
              if (typeof e[v] != "function") {
                var V = Error((u || "React class") + ": " + c + " type `" + v + "` is invalid; it must be a function, usually from the `prop-types` package, but received `" + typeof e[v] + "`.This often happens because of typos such as `PropTypes.function` instead of `PropTypes.func`.");
                throw V.name = "Invariant Violation", V;
              }
              d = e[v](a, v, u, c, null, "SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED");
            } catch (_) {
              d = _;
            }
            d && !(d instanceof Error) && (q(p), Z("%s: type specification of %s `%s` is invalid; the type checker function must return `null` or an `Error` but returned a %s. You may have forgotten to pass an argument to the type checker creator (arrayOf, instanceOf, objectOf, oneOf, oneOfType, and shape all require an argument).", u || "React class", c, v, typeof d), q(null)), d instanceof Error && !(d.message in y0) && (y0[d.message] = !0, q(p), Z("Failed %s type: %s", c, d.message), q(null));
          }
      }
    }
    var v1 = Array.isArray;
    function r0(e) {
      return v1(e);
    }
    function g1(e) {
      {
        var a = typeof Symbol == "function" && Symbol.toStringTag, c = a && e[Symbol.toStringTag] || e.constructor.name || "Object";
        return c;
      }
    }
    function p1(e) {
      try {
        return V0(e), !1;
      } catch {
        return !0;
      }
    }
    function V0(e) {
      return "" + e;
    }
    function C0(e) {
      if (p1(e))
        return Z("The provided key is an unsupported type %s. This value must be coerced to a string before before using it here.", g1(e)), V0(e);
    }
    var H0 = O.ReactCurrentOwner, f1 = {
      key: !0,
      ref: !0,
      __self: !0,
      __source: !0
    }, M0, k0;
    function m1(e) {
      if (D.call(e, "ref")) {
        var a = Object.getOwnPropertyDescriptor(e, "ref").get;
        if (a && a.isReactWarning)
          return !1;
      }
      return e.ref !== void 0;
    }
    function w1(e) {
      if (D.call(e, "key")) {
        var a = Object.getOwnPropertyDescriptor(e, "key").get;
        if (a && a.isReactWarning)
          return !1;
      }
      return e.key !== void 0;
    }
    function h1(e, a) {
      typeof e.ref == "string" && H0.current;
    }
    function _1(e, a) {
      {
        var c = function() {
          M0 || (M0 = !0, Z("%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://reactjs.org/link/special-props)", a));
        };
        c.isReactWarning = !0, Object.defineProperty(e, "key", {
          get: c,
          configurable: !0
        });
      }
    }
    function x1(e, a) {
      {
        var c = function() {
          k0 || (k0 = !0, Z("%s: `ref` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://reactjs.org/link/special-props)", a));
        };
        c.isReactWarning = !0, Object.defineProperty(e, "ref", {
          get: c,
          configurable: !0
        });
      }
    }
    var A1 = function(e, a, c, u, p, f, v) {
      var d = {
        // This tag allows us to uniquely identify this as a React Element
        $$typeof: o,
        // Built-in properties that belong on the element
        type: e,
        key: a,
        ref: c,
        props: v,
        // Record the component responsible for creating this element.
        _owner: f
      };
      return d._store = {}, Object.defineProperty(d._store, "validated", {
        configurable: !1,
        enumerable: !1,
        writable: !0,
        value: !1
      }), Object.defineProperty(d, "_self", {
        configurable: !1,
        enumerable: !1,
        writable: !1,
        value: u
      }), Object.defineProperty(d, "_source", {
        configurable: !1,
        enumerable: !1,
        writable: !1,
        value: p
      }), Object.freeze && (Object.freeze(d.props), Object.freeze(d)), d;
    };
    function y1(e, a, c, u, p) {
      {
        var f, v = {}, d = null, V = null;
        c !== void 0 && (C0(c), d = "" + c), w1(a) && (C0(a.key), d = "" + a.key), m1(a) && (V = a.ref, h1(a, p));
        for (f in a)
          D.call(a, f) && !f1.hasOwnProperty(f) && (v[f] = a[f]);
        if (e && e.defaultProps) {
          var _ = e.defaultProps;
          for (f in _)
            v[f] === void 0 && (v[f] = _[f]);
        }
        if (d || V) {
          var x = typeof e == "function" ? e.displayName || e.name || "Unknown" : e;
          d && _1(v, x), V && x1(v, x);
        }
        return A1(e, d, V, p, u, H0.current, v);
      }
    }
    var l0 = O.ReactCurrentOwner, L0 = O.ReactDebugCurrentFrame;
    function j(e) {
      if (e) {
        var a = e._owner, c = Y(e.type, e._source, a ? a.type : null);
        L0.setExtraStackFrame(c);
      } else
        L0.setExtraStackFrame(null);
    }
    var t0;
    t0 = !1;
    function a0(e) {
      return typeof e == "object" && e !== null && e.$$typeof === o;
    }
    function E0() {
      {
        if (l0.current) {
          var e = R(l0.current.type);
          if (e)
            return `

Check the render method of \`` + e + "`.";
        }
        return "";
      }
    }
    function Z1(e) {
      return "";
    }
    var R0 = {};
    function V1(e) {
      {
        var a = E0();
        if (!a) {
          var c = typeof e == "string" ? e : e.displayName || e.name;
          c && (a = `

Check the top-level render call using <` + c + ">.");
        }
        return a;
      }
    }
    function S0(e, a) {
      {
        if (!e._store || e._store.validated || e.key != null)
          return;
        e._store.validated = !0;
        var c = V1(a);
        if (R0[c])
          return;
        R0[c] = !0;
        var u = "";
        e && e._owner && e._owner !== l0.current && (u = " It was passed a child from " + R(e._owner.type) + "."), j(e), Z('Each child in a list should have a unique "key" prop.%s%s See https://reactjs.org/link/warning-keys for more information.', c, u), j(null);
      }
    }
    function B0(e, a) {
      {
        if (typeof e != "object")
          return;
        if (r0(e))
          for (var c = 0; c < e.length; c++) {
            var u = e[c];
            a0(u) && S0(u, a);
          }
        else if (a0(e))
          e._store && (e._store.validated = !0);
        else if (e) {
          var p = M(e);
          if (typeof p == "function" && p !== e.entries)
            for (var f = p.call(e), v; !(v = f.next()).done; )
              a0(v.value) && S0(v.value, a);
        }
      }
    }
    function C1(e) {
      {
        var a = e.type;
        if (a == null || typeof a == "string")
          return;
        var c;
        if (typeof a == "function")
          c = a.propTypes;
        else if (typeof a == "object" && (a.$$typeof === w || // Note: Memo only checks outer props here.
        // Inner props are checked in the reconciler.
        a.$$typeof === y))
          c = a.propTypes;
        else
          return;
        if (c) {
          var u = R(a);
          d1(c, e.props, "prop", u, e);
        } else if (a.PropTypes !== void 0 && !t0) {
          t0 = !0;
          var p = R(a);
          Z("Component %s declared `PropTypes` instead of `propTypes`. Did you misspell the property assignment?", p || "Unknown");
        }
        typeof a.getDefaultProps == "function" && !a.getDefaultProps.isReactClassApproved && Z("getDefaultProps is only used on classic React.createClass definitions. Use a static property named `defaultProps` instead.");
      }
    }
    function H1(e) {
      {
        for (var a = Object.keys(e.props), c = 0; c < a.length; c++) {
          var u = a[c];
          if (u !== "children" && u !== "key") {
            j(e), Z("Invalid prop `%s` supplied to `React.Fragment`. React.Fragment can only have `key` and `children` props.", u), j(null);
            break;
          }
        }
        e.ref !== null && (j(e), Z("Invalid attribute `ref` supplied to `React.Fragment`."), j(null));
      }
    }
    var P0 = {};
    function O0(e, a, c, u, p, f) {
      {
        var v = a1(e);
        if (!v) {
          var d = "";
          (e === void 0 || typeof e == "object" && e !== null && Object.keys(e).length === 0) && (d += " You likely forgot to export your component from the file it's defined in, or you might have mixed up default and named imports.");
          var V = Z1();
          V ? d += V : d += E0();
          var _;
          e === null ? _ = "null" : r0(e) ? _ = "array" : e !== void 0 && e.$$typeof === o ? (_ = "<" + (R(e.type) || "Unknown") + " />", d = " Did you accidentally export a JSX literal instead of a component?") : _ = typeof e, Z("React.jsx: type is invalid -- expected a string (for built-in components) or a class/function (for composite components) but got: %s.%s", _, d);
        }
        var x = y1(e, a, c, p, f);
        if (x == null)
          return x;
        if (v) {
          var k = a.children;
          if (k !== void 0)
            if (u)
              if (r0(k)) {
                for (var T = 0; T < k.length; T++)
                  B0(k[T], e);
                Object.freeze && Object.freeze(k);
              } else
                Z("React.jsx: Static children should always be an array. You are likely explicitly calling React.jsxs or React.jsxDEV. Use the Babel transform instead.");
            else
              B0(k, e);
        }
        if (D.call(a, "key")) {
          var P = R(e), C = Object.keys(a).filter(function(S1) {
            return S1 !== "key";
          }), o0 = C.length > 0 ? "{key: someKey, " + C.join(": ..., ") + ": ...}" : "{key: someKey}";
          if (!P0[P + o0]) {
            var R1 = C.length > 0 ? "{" + C.join(": ..., ") + ": ...}" : "{}";
            Z(`A props object containing a "key" prop is being spread into JSX:
  let props = %s;
  <%s {...props} />
React keys must be passed directly to JSX without using spread:
  let props = %s;
  <%s key={someKey} {...props} />`, o0, P, R1, P), P0[P + o0] = !0;
          }
        }
        return e === r ? H1(x) : C1(x), x;
      }
    }
    function M1(e, a, c) {
      return O0(e, a, c, !0);
    }
    function k1(e, a, c) {
      return O0(e, a, c, !1);
    }
    var L1 = k1, E1 = M1;
    I.Fragment = r, I.jsx = L1, I.jsxs = E1;
  }()), I;
}
process.env.NODE_ENV === "production" ? n0.exports = G1() : n0.exports = z1();
var m = n0.exports;
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
}, I0 = {
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
function Je({
  variant: t = "primary",
  size: o = "md",
  className: n = "",
  style: r,
  children: l,
  ripple: i = !1,
  ...s
}) {
  const g = i && t !== "danger";
  return /* @__PURE__ */ m.jsx(
    "button",
    {
      type: "button",
      className: [
        g ? "btn-ripple" : "btn-no-ripple",
        X1,
        J1[o],
        K1[t],
        Q1[t],
        n
      ].join(" "),
      style: {
        ...g && I0[t] ? { "--btn-ripple": I0[t] } : {},
        ...r
      },
      ...s,
      children: l
    }
  );
}
const ii = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M224,120v96a8,8,0,0,1-8,8H160a8,8,0,0,1-8-8V164a4,4,0,0,0-4-4H108a4,4,0,0,0-4,4v52a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V120a16,16,0,0,1,4.69-11.31l80-80a16,16,0,0,1,22.62,0l80,80A16,16,0,0,1,224,120Z"/></svg>', ei = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M247.44,173.75a.68.68,0,0,0,0-.14L231.05,89.44c0-.06,0-.12,0-.18A60.08,60.08,0,0,0,172,40H83.89a59.88,59.88,0,0,0-59,49.52L8.58,173.61a.68.68,0,0,0,0,.14,36,36,0,0,0,60.9,31.71l.35-.37L109.52,160h37l39.71,45.09c.11.13.23.25.35.37A36.08,36.08,0,0,0,212,216a36,36,0,0,0,35.43-42.25ZM104,112H96v8a8,8,0,0,1-16,0v-8H72a8,8,0,0,1,0-16h8V88a8,8,0,0,1,16,0v8h8a8,8,0,0,1,0,16Zm40-8a8,8,0,0,1,8-8h24a8,8,0,0,1,0,16H152A8,8,0,0,1,144,104Zm84.37,87.47a19.84,19.84,0,0,1-12.9,8.23A20.09,20.09,0,0,1,198,194.31L167.8,160H172a60,60,0,0,0,51-28.38l8.74,45A19.82,19.82,0,0,1,228.37,191.47Z"/></svg>', ri = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M232,208a8,8,0,0,1-8,8H32a8,8,0,0,1,0-16h8V136a8,8,0,0,1,8-8H72a8,8,0,0,1,8,8v64H96V88a8,8,0,0,1,8-8h32a8,8,0,0,1,8,8V200h16V40a8,8,0,0,1,8-8h40a8,8,0,0,1,8,8V200h8A8,8,0,0,1,232,208Z"/></svg>', li = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M224,200h-8V40a8,8,0,0,0-8-8H152a8,8,0,0,0-8,8V80H96a8,8,0,0,0-8,8v40H48a8,8,0,0,0-8,8v64H32a8,8,0,0,0,0,16H224a8,8,0,0,0,0-16ZM160,48h40V200H160ZM104,96h40V200H104ZM56,144H88v56H56Z"/></svg>', ti = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M216,40H72A16,16,0,0,0,56,56V72H40A16,16,0,0,0,24,88V200a16,16,0,0,0,16,16H184a16,16,0,0,0,16-16V184h16a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40ZM172,72a12,12,0,1,1-12,12A12,12,0,0,1,172,72Zm12,128H40V88H56v80a16,16,0,0,0,16,16H184Zm32-32H72V120.69l30.34-30.35a8,8,0,0,1,11.32,0L163.31,140,189,114.34a8,8,0,0,1,11.31,0L216,130.07V168Z"/></svg>', ai = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M128,24C74.17,24,32,48.6,32,80v96c0,31.4,42.17,56,96,56s96-24.6,96-56V80C224,48.6,181.83,24,128,24Zm80,104c0,9.62-7.88,19.43-21.61,26.92C170.93,163.35,150.19,168,128,168s-42.93-4.65-58.39-13.08C55.88,147.43,48,137.62,48,128V111.36c17.06,15,46.23,24.64,80,24.64s62.94-9.68,80-24.64Zm-21.61,74.92C170.93,211.35,150.19,216,128,216s-42.93-4.65-58.39-13.08C55.88,195.43,48,185.62,48,176V159.36c17.06,15,46.23,24.64,80,24.64s62.94-9.68,80-24.64V176C208,185.62,200.12,195.43,186.39,202.92Z"/></svg>', oi = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M224,128a8,8,0,0,1-8,8H136v80a8,8,0,0,1-16,0V136H40a8,8,0,0,1,0-16h80V40a8,8,0,0,1,16,0v80h80A8,8,0,0,1,224,128Z"/></svg>', si = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M231.92,132.11c-2.09,54-45.83,97.72-99.81,99.81A104.06,104.06,0,0,1,25.6,109.76a4,4,0,0,1,6.77-2.08l43,43a28,28,0,0,0,42.42,34.92l61.1-49.84a36,36,0,1,0-50.71-50.65l-43,52.74L35,87.67a4,4,0,0,1-.76-4.6,104,104,0,0,1,197.7,49ZM121.58,118.55,90.77,156.33A11.83,11.83,0,0,0,88,163.19,12.19,12.19,0,0,0,99.85,176a11.84,11.84,0,0,0,7.78-2.74l0,0,37.78-30.81A36.18,36.18,0,0,1,121.58,118.55ZM175.9,110A20,20,0,1,0,158,127.9,20,20,0,0,0,175.9,110Z"/></svg>', ni = '<svg width="2471" height="2500" viewBox="0 0 256 259" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid"><path d="M127.779 0C60.42 0 5.24 52.412 0 119.014l68.724 28.674a35.812 35.812 0 0 1 20.426-6.366c.682 0 1.356.019 2.02.056l30.566-44.71v-.626c0-26.903 21.69-48.796 48.353-48.796 26.662 0 48.352 21.893 48.352 48.796 0 26.902-21.69 48.804-48.352 48.804-.37 0-.73-.009-1.098-.018l-43.593 31.377c.028.582.046 1.163.046 1.735 0 20.204-16.283 36.636-36.294 36.636-17.566 0-32.263-12.658-35.584-29.412L4.41 164.654c15.223 54.313 64.673 94.132 123.369 94.132 70.818 0 128.221-57.938 128.221-129.393C256 57.93 198.597 0 127.779 0zM80.352 196.332l-15.749-6.568c2.787 5.867 7.621 10.775 14.033 13.47 13.857 5.83 29.836-.803 35.612-14.799a27.555 27.555 0 0 0 .046-21.035c-2.768-6.79-7.999-12.086-14.706-14.909-6.67-2.795-13.811-2.694-20.085-.304l16.275 6.79c10.222 4.3 15.056 16.145 10.794 26.46-4.253 10.314-15.998 15.195-26.22 10.895zm121.957-100.29c0-17.925-14.457-32.52-32.217-32.52-17.769 0-32.226 14.595-32.226 32.52 0 17.926 14.457 32.512 32.226 32.512 17.76 0 32.217-14.586 32.217-32.512zm-56.37-.055c0-13.488 10.84-24.42 24.2-24.42 13.368 0 24.208 10.932 24.208 24.42 0 13.488-10.84 24.421-24.209 24.421-13.359 0-24.2-10.933-24.2-24.42z" fill="currentColor"/></svg>', ci = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M208,80H96V56a32,32,0,0,1,32-32c15.37,0,29.2,11,32.16,25.59a8,8,0,0,0,15.68-3.18C171.32,24.15,151.2,8,128,8A48.05,48.05,0,0,0,80,56V80H48A16,16,0,0,0,32,96V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80Zm-72,78.63V184a8,8,0,0,1-16,0V158.63a24,24,0,1,1,16,0Z"/></svg>', ui = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M164.47,195.63a8,8,0,0,1-6.7,12.37H10.23a8,8,0,0,1-6.7-12.37,95.83,95.83,0,0,1,47.22-37.71,60,60,0,1,1,66.5,0A95.83,95.83,0,0,1,164.47,195.63Zm87.91-.15a95.87,95.87,0,0,0-47.13-37.56A60,60,0,0,0,144.7,54.59a4,4,0,0,0-1.33,6A75.83,75.83,0,0,1,147,150.53a4,4,0,0,0,1.07,5.53,112.32,112.32,0,0,1,29.85,30.83,23.92,23.92,0,0,1,3.65,16.47,4,4,0,0,0,3.95,4.64h60.3a8,8,0,0,0,7.73-5.93A8.22,8.22,0,0,0,252.38,195.48Z"/></svg>', bi = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M200,88V200a16,16,0,0,1-16,16H40a16,16,0,0,1-16-16V88A16,16,0,0,1,40,72H184A16,16,0,0,1,200,88Zm16-48H64a8,8,0,0,0,0,16H216V176a8,8,0,0,0,16,0V56A16,16,0,0,0,216,40Z"/></svg>', $0 = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M74.34,85.66A8,8,0,0,1,85.66,74.34L120,108.69V24a8,8,0,0,1,16,0v84.69l34.34-34.35a8,8,0,0,1,11.32,11.32l-48,48a8,8,0,0,1-11.32,0ZM240,136v64a16,16,0,0,1-16,16H32a16,16,0,0,1-16-16V136a16,16,0,0,1,16-16H84.4a4,4,0,0,1,2.83,1.17L111,145A24,24,0,0,0,145,145l23.8-23.8A4,4,0,0,1,171.6,120H224A16,16,0,0,1,240,136Zm-40,32a12,12,0,1,0-12,12A12,12,0,0,0,200,168Z"/></svg>', di = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M160.06,40A88.1,88.1,0,0,0,81.29,88.67h0A87.48,87.48,0,0,0,72,127.73,8.18,8.18,0,0,1,64.57,136,8,8,0,0,1,56,128a103.66,103.66,0,0,1,5.34-32.92,4,4,0,0,0-4.75-5.18A64.09,64.09,0,0,0,8,152c0,35.19,29.75,64,65,64H160a88.09,88.09,0,0,0,87.93-91.48C246.11,77.54,207.07,40,160.06,40Z"/></svg>', W0 = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M216.57,39.43A80,80,0,0,0,83.91,120.78L28.69,176A15.86,15.86,0,0,0,24,187.31V216a16,16,0,0,0,16,16H72a8,8,0,0,0,8-8V208H96a8,8,0,0,0,8-8V184h16a8,8,0,0,0,5.66-2.34l9.56-9.57A79.73,79.73,0,0,0,160,176h.1A80,80,0,0,0,216.57,39.43ZM180,92a16,16,0,1,1,16-16A16,16,0,0,1,180,92Z"/></svg>', vi = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M216,130.16q.06-2.16,0-4.32l14.92-18.64a8,8,0,0,0,1.48-7.06,107.6,107.6,0,0,0-10.88-26.25,8,8,0,0,0-6-3.93l-23.72-2.64q-1.48-1.56-3-3L186,40.54a8,8,0,0,0-3.94-6,107.29,107.29,0,0,0-26.25-10.86,8,8,0,0,0-7.06,1.48L130.16,40Q128,40,125.84,40L107.2,25.11a8,8,0,0,0-7.06-1.48A107.6,107.6,0,0,0,73.89,34.51a8,8,0,0,0-3.93,6L67.32,64.27q-1.56,1.49-3,3L40.54,70a8,8,0,0,0-6,3.94,107.71,107.71,0,0,0-10.87,26.25,8,8,0,0,0,1.49,7.06L40,125.84Q40,128,40,130.16L25.11,148.8a8,8,0,0,0-1.48,7.06,107.6,107.6,0,0,0,10.88,26.25,8,8,0,0,0,6,3.93l23.72,2.64q1.49,1.56,3,3L70,215.46a8,8,0,0,0,3.94,6,107.71,107.71,0,0,0,26.25,10.87,8,8,0,0,0,7.06-1.49L125.84,216q2.16.06,4.32,0l18.64,14.92a8,8,0,0,0,7.06,1.48,107.21,107.21,0,0,0,26.25-10.88,8,8,0,0,0,3.93-6l2.64-23.72q1.56-1.48,3-3L215.46,186a8,8,0,0,0,6-3.94,107.71,107.71,0,0,0,10.87-26.25,8,8,0,0,0-1.49-7.06ZM128,168a40,40,0,1,1,40-40A40,40,0,0,1,128,168Z"/></svg>', U0 = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm-4,48a12,12,0,1,1-12,12A12,12,0,0,1,124,72Zm12,112a16,16,0,0,1-16-16V128a8,8,0,0,1,0-16,16,16,0,0,1,16,16v40a8,8,0,0,1,0,16Z"/></svg>', gi = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M109.66,146.34a8,8,0,0,1,0,11.32L83.31,184l18.35,18.34A8,8,0,0,1,96,216H48a8,8,0,0,1-8-8V160a8,8,0,0,1,13.66-5.66L72,172.69l26.34-26.35A8,8,0,0,1,109.66,146.34ZM83.31,72l18.35-18.34A8,8,0,0,0,96,40H48a8,8,0,0,0-8,8V96a8,8,0,0,0,13.66,5.66L72,83.31l26.34,26.35a8,8,0,0,0,11.32-11.32ZM208,40H160a8,8,0,0,0-5.66,13.66L172.69,72,146.34,98.34a8,8,0,0,0,11.32,11.32L184,83.31l18.34,18.35A8,8,0,0,0,216,96V48A8,8,0,0,0,208,40Zm3.06,112.61a8,8,0,0,0-8.72,1.73L184,172.69l-26.34-26.35a8,8,0,0,0-11.32,11.32L172.69,184l-18.35,18.34A8,8,0,0,0,160,216h48a8,8,0,0,0,8-8V160A8,8,0,0,0,211.06,152.61Z"/></svg>', pi = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M224,128a8,8,0,0,1-8,8H40a8,8,0,0,1,0-16H216A8,8,0,0,1,224,128ZM40,72H216a8,8,0,0,0,0-16H40a8,8,0,0,0,0,16ZM216,184H40a8,8,0,0,0,0,16H216a8,8,0,0,0,0-16Z"/></svg>', fi = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M207.58,63.84C186.85,53.48,159.33,48,128,48S69.15,53.48,48.42,63.84,16,88.78,16,104v48c0,15.22,11.82,29.85,32.42,40.16S96.67,208,128,208s58.85-5.48,79.58-15.84S240,167.22,240,152V104C240,88.78,228.18,74.15,207.58,63.84ZM128,64c62.64,0,96,23.23,96,40s-33.36,40-96,40-96-23.23-96-40S65.36,64,128,64Zm-8,95.86v32c-19-.62-35-3.42-48-7.49V153.05A203.43,203.43,0,0,0,120,159.86Zm16,0a203.43,203.43,0,0,0,48-6.81v31.31c-13,4.07-29,6.87-48,7.49ZM32,152V133.53a82.88,82.88,0,0,0,16.42,10.63c2.43,1.21,5,2.35,7.58,3.43V178C40.17,170.16,32,160.29,32,152Zm168,26V147.59c2.61-1.08,5.15-2.22,7.58-3.43A82.88,82.88,0,0,0,224,133.53V152C224,160.29,215.83,170.16,200,178Z"/></svg>', mi = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M176,160a39.89,39.89,0,0,0-28.62,12.09l-46.1-29.63a39.8,39.8,0,0,0,0-28.92l46.1-29.63a40,40,0,1,0-8.66-13.45l-46.1,29.63a40,40,0,1,0,0,55.82l46.1,29.63A40,40,0,1,0,176,160Zm0-128a24,24,0,1,1-24,24A24,24,0,0,1,176,32ZM64,152a24,24,0,1,1,24-24A24,24,0,0,1,64,152Zm112,72a24,24,0,1,1,24-24A24,24,0,0,1,176,224Z"/></svg>', wi = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M104,40H56A16,16,0,0,0,40,56v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V56A16,16,0,0,0,104,40Zm0,64H56V56h48v48Zm96-64H152a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V56A16,16,0,0,0,200,40Zm0,64H152V56h48v48Zm-96,32H56a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V152A16,16,0,0,0,104,136Zm0,64H56V152h48v48Zm96-64H152a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V152A16,16,0,0,0,200,136Zm0,64H152V152h48v48Z"/></svg>', hi = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M245,110.64A16,16,0,0,0,232,104H216V88a16,16,0,0,0-16-16H130.67L102.94,51.2a16.14,16.14,0,0,0-9.6-3.2H40A16,16,0,0,0,24,64V208h0a8,8,0,0,0,8,8H211.1a8,8,0,0,0,7.59-5.47l28.49-85.47A16.05,16.05,0,0,0,245,110.64ZM93.34,64,123.2,86.4A8,8,0,0,0,128,88h72v16H69.77a16,16,0,0,0-15.18,10.94L40,158.7V64Zm112,136H43.1l26.67-80H232Z"/></svg>', _i = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M224,48V96a8,8,0,0,1-8,8H168a8,8,0,0,1,0-16h28.69L182.06,73.37a79.56,79.56,0,0,0-56.13-23.43h-.45A79.52,79.52,0,0,0,69.59,72.71,8,8,0,0,1,58.41,61.27a96,96,0,0,1,135,.79L208,76.69V48a8,8,0,0,1,16,0ZM186.41,183.29a80,80,0,0,1-112.47-.66L59.31,168H88a8,8,0,0,0,0-16H40a8,8,0,0,0-8,8v48a8,8,0,0,0,16,0V179.31l14.63,14.63A95.43,95.43,0,0,0,130,222.06h.53a95.36,95.36,0,0,0,67.07-27.33,8,8,0,0,0-11.18-11.44Z"/></svg>', xi = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm-8-80V80a8,8,0,0,1,16,0v56a8,8,0,0,1-16,0Zm20,36a12,12,0,1,1-12-12A12,12,0,0,1,140,172Z"/></svg>', Ai = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z"/></svg>', yi = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M213.66,165.66a8,8,0,0,1-11.32,0L128,91.31,53.66,165.66a8,8,0,0,1-11.32-11.32l80-80a8,8,0,0,1,11.32,0l80,80A8,8,0,0,1,213.66,165.66Z"/></svg>', Zi = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M165.66,202.34a8,8,0,0,1-11.32,11.32l-80-80a8,8,0,0,1,0-11.32l80-80a8,8,0,0,1,11.32,11.32L91.31,128Z"/></svg>', Vi = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M181.66,133.66l-80,80a8,8,0,0,1-11.32-11.32L164.69,128,90.34,53.66a8,8,0,0,1,11.32-11.32l80,80A8,8,0,0,1,181.66,133.66Z"/></svg>', Ci = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M216,40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40Zm0,16V158.75l-26.07-26.06a16,16,0,0,0-22.63,0l-20,20-44-44a16,16,0,0,0-22.62,0L40,149.37V56ZM40,172l52-52,80,80H40Zm176,28H194.63l-36-36,20-20L216,181.38V200ZM144,100a12,12,0,1,1,12,12A12,12,0,0,1,144,100Z"/></svg>', Hi = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M216,40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16h64a8,8,0,0,0,7.59-5.47l14.83-44.48L163,151.43a8.07,8.07,0,0,0,4.46-4.46l14.62-36.55,44.48-14.83A8,8,0,0,0,232,88V56A16,16,0,0,0,216,40ZM112.41,157.47,98.23,200H40V172l52-52,30.42,30.42L117,152.57A8,8,0,0,0,112.41,157.47ZM216,82.23,173.47,96.41a8,8,0,0,0-4.9,4.62l-14.72,36.82L138.58,144l-35.27-35.27a16,16,0,0,0-22.62,0L40,149.37V56H216Zm12.68,33a8,8,0,0,0-7.21-1.1l-23.8,7.94a8,8,0,0,0-4.9,4.61l-14.31,35.77-35.77,14.31a8,8,0,0,0-4.61,4.9l-7.94,23.8A8,8,0,0,0,137.73,216H216a16,16,0,0,0,16-16V121.73A8,8,0,0,0,228.68,115.24ZM216,200H148.83l3.25-9.75,35.51-14.2a8.07,8.07,0,0,0,4.46-4.46l14.2-35.51,9.75-3.25Z"/></svg>', Mi = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z"/></svg>', ki = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M221.66,133.66l-72,72a8,8,0,0,1-11.32-11.32L196.69,136H40a8,8,0,0,1,0-16H196.69L138.34,61.66a8,8,0,0,1,11.32-11.32l72,72A8,8,0,0,1,221.66,133.66Z"/></svg>', Li = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z"/></svg>', Ei = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M168,112a56,56,0,1,1-56-56A56,56,0,0,1,168,112Zm61.66,117.66a8,8,0,0,1-11.32,0l-50.06-50.07a88,88,0,1,1,11.32-11.31l50.06,50.06A8,8,0,0,1,229.66,229.66ZM112,184a72,72,0,1,0-72-72A72.08,72.08,0,0,0,112,184Z"/></svg>', Ri = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M216,32H88a8,8,0,0,0-8,8V80H40a8,8,0,0,0-8,8V216a8,8,0,0,0,8,8H168a8,8,0,0,0,8-8V176h40a8,8,0,0,0,8-8V40A8,8,0,0,0,216,32ZM160,208H48V96H160Zm48-48H176V88a8,8,0,0,0-8-8H96V48H208Z"/></svg>', Si = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M227.31,73.37,182.63,28.68a16,16,0,0,0-22.63,0L36.69,152A15.86,15.86,0,0,0,32,163.31V208a16,16,0,0,0,16,16H92.69A15.86,15.86,0,0,0,104,219.31L227.31,96a16,16,0,0,0,0-22.63ZM51.31,160,136,75.31,152.69,92,68,176.68ZM48,179.31,76.69,208H48Zm48,25.38L79.31,188,164,103.31,180.69,120Zm96-96L147.31,64l24-24L216,84.68Z"/></svg>', Bi = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M216,48H176V40a24,24,0,0,0-24-24H104A24,24,0,0,0,80,40v8H40a8,8,0,0,0,0,16h8V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V64h8a8,8,0,0,0,0-16ZM96,40a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96Zm96,168H64V64H192ZM112,104v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm48,0v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Z"/></svg>', Pi = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M248,128a87.34,87.34,0,0,1-17.6,52.81,8,8,0,1,1-12.8-9.62A71.34,71.34,0,0,0,232,128a72,72,0,0,0-144,0,8,8,0,0,1-16,0,88,88,0,0,1,3.29-23.88C74.2,104,73.1,104,72,104a48,48,0,0,0,0,96H96a8,8,0,0,1,0,16H72A64,64,0,1,1,81.29,88.68,88,88,0,0,1,248,128Zm-69.66,42.34L160,188.69V128a8,8,0,0,0-16,0v60.69l-18.34-18.35a8,8,0,0,0-11.32,11.32l32,32a8,8,0,0,0,11.32,0l32-32a8,8,0,0,0-11.32-11.32Z"/></svg>', Oi = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M178.34,165.66,160,147.31V208a8,8,0,0,1-16,0V147.31l-18.34,18.35a8,8,0,0,1-11.32-11.32l32-32a8,8,0,0,1,11.32,0l32,32a8,8,0,0,1-11.32,11.32ZM160,40A88.08,88.08,0,0,0,81.29,88.68,64,64,0,1,0,72,216h40a8,8,0,0,0,0-16H72a48,48,0,0,1,0-96c1.1,0,2.2,0,3.29.12A88,88,0,0,0,72,128a8,8,0,0,0,16,0,72,72,0,1,1,100.8,66,8,8,0,0,0,3.2,15.34,7.9,7.9,0,0,0,3.2-.68A88,88,0,0,0,160,40Z"/></svg>', ji = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M224,64H32A16,16,0,0,0,16,80v96a16,16,0,0,0,16,16H224a16,16,0,0,0,16-16V80A16,16,0,0,0,224,64Zm0,112H32V80H224v96Zm-24-48a12,12,0,1,1-12-12A12,12,0,0,1,200,128Z"/></svg>', Ti = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M230.92,212c-15.23-26.33-38.7-45.21-66.09-54.16a72,72,0,1,0-73.66,0C63.78,166.78,40.31,185.66,25.08,212a8,8,0,1,0,13.85,8c18.84-32.56,52.14-52,89.07-52s70.23,19.44,89.07,52a8,8,0,1,0,13.85-8ZM72,96a56,56,0,1,1,56,56A56.06,56.06,0,0,1,72,96Z"/></svg>', Fi = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M128,24h0A104,104,0,1,0,232,128,104.12,104.12,0,0,0,128,24Zm88,104a87.61,87.61,0,0,1-3.33,24H174.16a157.44,157.44,0,0,0,0-48h38.51A87.61,87.61,0,0,1,216,128ZM102,168H154a115.11,115.11,0,0,1-26,45A115.27,115.27,0,0,1,102,168Zm-3.9-16a140.84,140.84,0,0,1,0-48h59.88a140.84,140.84,0,0,1,0,48ZM40,128a87.61,87.61,0,0,1,3.33-24H81.84a157.44,157.44,0,0,0,0,48H43.33A87.61,87.61,0,0,1,40,128ZM154,88H102a115.11,115.11,0,0,1,26-45A115.27,115.27,0,0,1,154,88Zm52.33,0H170.71a135.28,135.28,0,0,0-22.3-45.6A88.29,88.29,0,0,1,206.37,88ZM107.59,42.4A135.28,135.28,0,0,0,85.29,88H49.63A88.29,88.29,0,0,1,107.59,42.4ZM49.63,168H85.29a135.28,135.28,0,0,0,22.3,45.6A88.29,88.29,0,0,1,49.63,168Zm98.78,45.6a135.28,135.28,0,0,0,22.3-45.6h35.66A88.29,88.29,0,0,1,148.41,213.6Z"/></svg>', Di = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M224,104a8,8,0,0,1-16,0V59.32l-66.33,66.34a8,8,0,0,1-11.32-11.32L196.68,48H152a8,8,0,0,1,0-16h64a8,8,0,0,1,8,8Zm-40,24a8,8,0,0,0-8,8v72H48V80h72a8,8,0,0,0,0-16H48A16,16,0,0,0,32,80V208a16,16,0,0,0,16,16H176a16,16,0,0,0,16-16V136A8,8,0,0,0,184,128Z"/></svg>', Ni = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M208,40H48A24,24,0,0,0,24,64V176a24,24,0,0,0,24,24H208a24,24,0,0,0,24-24V64A24,24,0,0,0,208,40Zm8,136a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V64a8,8,0,0,1,8-8H208a8,8,0,0,1,8,8Zm-48,48a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h64A8,8,0,0,1,168,224Z"/></svg>', Ii = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm71.87,53.27L136,114.14V40.37A88,88,0,0,1,199.87,77.27ZM120,40.37v83l-71.89,41.5A88,88,0,0,1,120,40.37ZM128,216a88,88,0,0,1-71.87-37.27L207.89,91.12A88,88,0,0,1,128,216Z"/></svg>', $i = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M112.41,102.53a8,8,0,0,1,5.06-10.12l12-4A8,8,0,0,1,140,96v40a8,8,0,0,1-16,0V107.1l-1.47.49A8,8,0,0,1,112.41,102.53ZM248,208a8,8,0,0,1-8,8H16a8,8,0,0,1,0-16h8V104A16,16,0,0,1,40,88H80V56A16,16,0,0,1,96,40h64a16,16,0,0,1,16,16v72h40a16,16,0,0,1,16,16v56h8A8,8,0,0,1,248,208Zm-72-64v56h40V144ZM96,200h64V56H96Zm-56,0H80V104H40Z"/></svg>', Wi = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm64-88a8,8,0,0,1-8,8H128a8,8,0,0,1-8-8V72a8,8,0,0,1,16,0v48h48A8,8,0,0,1,192,128Z"/></svg>', Ui = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M173.66,98.34a8,8,0,0,1,0,11.32l-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35A8,8,0,0,1,173.66,98.34ZM232,128A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z"/></svg>', Yi = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M165.66,101.66,139.31,128l26.35,26.34a8,8,0,0,1-11.32,11.32L128,139.31l-26.34,26.35a8,8,0,0,1-11.32-11.32L116.69,128,90.34,101.66a8,8,0,0,1,11.32-11.32L128,116.69l26.34-26.35a8,8,0,0,1,11.32,11.32ZM232,128A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z"/></svg>', qi = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M140,180a12,12,0,1,1-12-12A12,12,0,0,1,140,180ZM128,72c-22.06,0-40,16.15-40,36v4a8,8,0,0,0,16,0v-4c0-11,10.77-20,24-20s24,9,24,20-10.77,20-24,20a8,8,0,0,0-8,8v8a8,8,0,0,0,16,0v-.72c18.24-3.35,32-17.9,32-35.28C168,88.15,150.06,72,128,72Zm104,56A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z"/></svg>', Gi = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"/></svg>', zi = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z"/></svg>', Ki = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M240,96a8,8,0,0,1-8,8H216v16a8,8,0,0,1-16,0V104H184a8,8,0,0,1,0-16h16V72a8,8,0,0,1,16,0V88h16A8,8,0,0,1,240,96ZM144,56h8v8a8,8,0,0,0,16,0V56h8a8,8,0,0,0,0-16h-8V32a8,8,0,0,0-16,0v8h-8a8,8,0,0,0,0,16Zm72.77,97a8,8,0,0,1,1.43,8A96,96,0,1,1,95.07,37.8a8,8,0,0,1,10.6,9.06A88.07,88.07,0,0,0,209.14,150.33,8,8,0,0,1,216.77,153Zm-19.39,14.88c-1.79.09-3.59.14-5.38.14A104.11,104.11,0,0,1,88,64c0-1.79,0-3.59.14-5.38A80,80,0,1,0,197.38,167.86Z"/></svg>', Qi = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M120,40V16a8,8,0,0,1,16,0V40a8,8,0,0,1-16,0Zm72,88a64,64,0,1,1-64-64A64.07,64.07,0,0,1,192,128Zm-16,0a48,48,0,1,0-48,48A48.05,48.05,0,0,0,176,128ZM58.34,69.66A8,8,0,0,0,69.66,58.34l-16-16A8,8,0,0,0,42.34,53.66Zm0,116.68-16,16a8,8,0,0,0,11.32,11.32l16-16a8,8,0,0,0-11.32-11.32ZM192,72a8,8,0,0,0,5.66-2.34l16-16a8,8,0,0,0-11.32-11.32l-16,16A8,8,0,0,0,192,72Zm5.66,114.34a8,8,0,0,0-11.32,11.32l16,16a8,8,0,0,0,11.32-11.32ZM48,128a8,8,0,0,0-8-8H16a8,8,0,0,0,0,16H40A8,8,0,0,0,48,128Zm80,80a8,8,0,0,0-8,8v24a8,8,0,0,0,16,0V216A8,8,0,0,0,128,208Zm112-88H216a8,8,0,0,0,0,16h24a8,8,0,0,0,0-16Z"/></svg>', Ji = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M235.32,81.37,174.63,20.69a16,16,0,0,0-22.63,0L98.37,74.49c-10.66-3.34-35-7.37-60.4,13.14a16,16,0,0,0-1.29,23.78L85,159.71,42.34,202.34a8,8,0,0,0,11.32,11.32L96.29,171l48.29,48.29A16,16,0,0,0,155.9,224c.38,0,.75,0,1.13,0a15.93,15.93,0,0,0,11.64-6.33c19.64-26.1,17.75-47.32,13.19-60L235.33,104A16,16,0,0,0,235.32,81.37ZM224,92.69h0l-57.27,57.46a8,8,0,0,0-1.49,9.22c9.46,18.93-1.8,38.59-9.34,48.62L48,100.08c12.08-9.74,23.64-12.31,32.48-12.31A40.13,40.13,0,0,1,96.81,91a8,8,0,0,0,9.25-1.51L163.32,32,224,92.68Z"/></svg>', Xi = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M240,136v64a16,16,0,0,1-16,16H32a16,16,0,0,1-16-16V136a16,16,0,0,1,16-16H80a8,8,0,0,1,0,16H32v64H224V136H176a8,8,0,0,1,0-16h48A16,16,0,0,1,240,136ZM85.66,77.66,120,43.31V128a8,8,0,0,0,16,0V43.31l34.34,34.35a8,8,0,0,0,11.32-11.32l-48-48a8,8,0,0,0-11.32,0l-48,48A8,8,0,0,0,85.66,77.66ZM200,168a12,12,0,1,0-12,12A12,12,0,0,0,200,168Z"/></svg>', ie = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M221.8,175.94C216.25,166.38,208,139.33,208,104a80,80,0,1,0-160,0c0,35.34-8.26,62.38-13.81,71.94A16,16,0,0,0,48,200H88.81a40,40,0,0,0,78.38,0H208a16,16,0,0,0,13.8-24.06ZM128,216a24,24,0,0,1-22.62-16h45.24A24,24,0,0,1,128,216ZM48,184c7.7-13.24,16-43.92,16-80a64,64,0,1,1,128,0c0,36.05,8.28,66.73,16,80Z"/></svg>', ee = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M224,48H32A16,16,0,0,0,16,64V88a16,16,0,0,0,16,16v88a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V104a16,16,0,0,0,16-16V64A16,16,0,0,0,224,48ZM208,192H48V104H208ZM224,88H32V64H224V88ZM96,136a8,8,0,0,1,8-8h48a8,8,0,0,1,0,16H104A8,8,0,0,1,96,136Z"/></svg>', re = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M219.31,72,184,36.69A15.86,15.86,0,0,0,172.69,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V83.31A15.86,15.86,0,0,0,219.31,72ZM168,208H88V152h80Zm40,0H184V152a16,16,0,0,0-16-16H88a16,16,0,0,0-16,16v56H48V48H172.69L208,83.31ZM160,72a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h56A8,8,0,0,1,160,72Z"/></svg>', s0 = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M239.18,97.26A16.38,16.38,0,0,0,224.92,86l-59-4.76L143.14,26.15a16.36,16.36,0,0,0-30.27,0L90.11,81.23,31.08,86a16.46,16.46,0,0,0-9.37,28.86l45,38.83L53,211.75a16.38,16.38,0,0,0,24.5,17.82L128,198.49l50.53,31.08A16.4,16.4,0,0,0,203,211.75l-13.76-58.07,45-38.83A16.43,16.43,0,0,0,239.18,97.26Zm-15.34,5.47-48.7,42a8,8,0,0,0-2.56,7.91l14.88,62.8a.37.37,0,0,1-.17.48c-.18.14-.23.11-.38,0l-54.72-33.65a8,8,0,0,0-8.38,0L69.09,215.94c-.15.09-.19.12-.38,0a.37.37,0,0,1-.17-.48l14.88-62.8a8,8,0,0,0-2.56-7.91l-48.7-42c-.12-.1-.23-.19-.13-.5s.18-.27.33-.29l63.92-5.16A8,8,0,0,0,103,91.86l24.62-59.61c.08-.17.11-.25.35-.25s.27.08.35.25L153,91.86a8,8,0,0,0,6.75,4.92l63.92,5.16c.15,0,.24,0,.33.29S224,102.63,223.84,102.73Z"/></svg>', le = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M234.29,114.85l-45,38.83L203,211.75a16.4,16.4,0,0,1-24.5,17.82L128,198.49,77.47,229.57A16.4,16.4,0,0,1,53,211.75l13.76-58.07-45-38.83A16.46,16.46,0,0,1,31.08,86l59-4.76,22.76-55.08a16.36,16.36,0,0,1,30.27,0l22.75,55.08,59,4.76a16.46,16.46,0,0,1,9.37,28.86Z"/></svg>', te = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M178,40c-20.65,0-38.73,8.88-50,23.89C116.73,48.88,98.65,40,78,40a62.07,62.07,0,0,0-62,62c0,70,103.79,126.66,108.21,129a8,8,0,0,0,7.58,0C136.21,228.66,240,172,240,102A62.07,62.07,0,0,0,178,40ZM128,214.8C109.74,204.16,32,155.69,32,102A46.06,46.06,0,0,1,78,56c19.45,0,35.78,10.36,42.6,27a8,8,0,0,0,14.8,0c6.82-16.67,23.15-27,42.6-27a46.06,46.06,0,0,1,46,46C224,155.61,146.24,204.15,128,214.8Z"/></svg>', ae = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M240,102c0,70-103.79,126.66-108.21,129a8,8,0,0,1-7.58,0C119.79,228.66,16,172,16,102A62.07,62.07,0,0,1,78,40c20.65,0,38.73,8.88,50,23.89C139.27,48.88,157.35,40,178,40A62.07,62.07,0,0,1,240,102Z"/></svg>', oe = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M184,32H72A16,16,0,0,0,56,48V224a8,8,0,0,0,12.24,6.78L128,193.43l59.77,37.35A8,8,0,0,0,200,224V48A16,16,0,0,0,184,32Zm0,177.57-51.77-32.35a8,8,0,0,0-8.48,0L72,209.57V48H184Z"/></svg>', se = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M184,32H72A16,16,0,0,0,56,48V224a8,8,0,0,0,12.24,6.78L128,193.43l59.77,37.35A8,8,0,0,0,200,224V48A16,16,0,0,0,184,32Z"/></svg>', ne = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M247.31,124.76c-.35-.79-8.82-19.58-27.65-38.41C194.57,61.26,162.88,48,128,48S61.43,61.26,36.34,86.35C17.51,105.18,9,124,8.69,124.76a8,8,0,0,0,0,6.5c.35.79,8.82,19.57,27.65,38.4C61.43,194.74,93.12,208,128,208s66.57-13.26,91.66-38.34c18.83-18.83,27.3-37.61,27.65-38.4A8,8,0,0,0,247.31,124.76ZM128,192c-30.78,0-57.67-11.19-79.93-33.25A133.47,133.47,0,0,1,25,128,133.33,133.33,0,0,1,48.07,97.25C70.33,75.19,97.22,64,128,64s57.67,11.19,79.93,33.25A133.46,133.46,0,0,1,231.05,128C223.84,141.46,192.43,192,128,192Zm0-112a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160Z"/></svg>', ce = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M53.92,34.62A8,8,0,1,0,42.08,45.38L61.32,66.55C25,88.84,9.38,123.2,8.69,124.76a8,8,0,0,0,0,6.5c.35.79,8.82,19.57,27.65,38.4C61.43,194.74,93.12,208,128,208a127.11,127.11,0,0,0,52.07-10.83l22,24.21a8,8,0,1,0,11.84-10.76Zm47.33,75.84,41.67,45.85a32,32,0,0,1-41.67-45.85ZM128,192c-30.78,0-57.67-11.19-79.93-33.25A133.16,133.16,0,0,1,25,128c4.69-8.79,19.66-33.39,47.35-49.38l18,19.75a48,48,0,0,0,63.66,70l14.73,16.2A112,112,0,0,1,128,192Zm6-95.43a8,8,0,0,1,3-15.72,48.16,48.16,0,0,1,38.77,42.64,8,8,0,0,1-7.22,8.71,6.39,6.39,0,0,1-.75,0,8,8,0,0,1-8-7.26A32.09,32.09,0,0,0,134,96.57Zm113.28,34.69c-.42.94-10.55,23.37-33.36,43.8a8,8,0,1,1-10.67-11.92A132.77,132.77,0,0,0,231.05,128a133.15,133.15,0,0,0-23.12-30.77C185.67,75.19,158.78,64,128,64a118.37,118.37,0,0,0-19.36,1.57A8,8,0,1,1,106,49.79,134,134,0,0,1,128,48c34.88,0,66.57,13.26,91.66,38.35,18.83,18.83,27.3,37.62,27.65,38.41A8,8,0,0,1,247.31,131.26Z"/></svg>', ue = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M232,64H208V48a8,8,0,0,0-8-8H56a8,8,0,0,0-8,8V64H24A16,16,0,0,0,8,80V96a40,40,0,0,0,40,40h3.65A80.13,80.13,0,0,0,120,191.61V216H96a8,8,0,0,0,0,16h64a8,8,0,0,0,0-16H136V191.58c31.94-3.23,58.44-25.64,68.08-55.58H208a40,40,0,0,0,40-40V80A16,16,0,0,0,232,64ZM48,120A24,24,0,0,1,24,96V80H48v32q0,4,.39,8Zm144-8.9c0,35.52-29,64.64-64,64.9a64,64,0,0,1-64-64V56H192ZM232,96a24,24,0,0,1-24,24h-.5a81.81,81.81,0,0,0,.5-8.9V80h24Z"/></svg>', be = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M232,64H208V48a8,8,0,0,0-8-8H56a8,8,0,0,0-8,8V64H24A16,16,0,0,0,8,80V96a40,40,0,0,0,40,40h3.65A80.13,80.13,0,0,0,120,191.61V216H96a8,8,0,0,0,0,16h64a8,8,0,0,0,0-16H136V191.58c31.94-3.23,58.44-25.64,68.08-55.58H208a40,40,0,0,0,40-40V80A16,16,0,0,0,232,64ZM48,120A24,24,0,0,1,24,96V80H48v32q0,4,.39,8ZM232,96a24,24,0,0,1-24,24h-.5a81.81,81.81,0,0,0,.5-8.9V80h24Z"/></svg>', de = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M240,200h-8V144a16,16,0,0,0-16-16H176V56a16,16,0,0,0-16-16H96A16,16,0,0,0,80,56V88H40a16,16,0,0,0-16,16v96H16a8,8,0,0,0,0,16H240a8,8,0,0,0,0-16ZM80,200H40V104H80Zm60-64a8,8,0,0,1-16,0V107.1l-1.47.49a8,8,0,0,1-5.06-15.18l12-4A8,8,0,0,1,140,96Zm76,64H176V144h40Z"/></svg>', ve = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M212.92,17.69a8,8,0,0,0-6.86-1.45l-128,32A8,8,0,0,0,72,56V166.08A36,36,0,1,0,88,196V110.25l112-28v51.83A36,36,0,1,0,216,164V24A8,8,0,0,0,212.92,17.69ZM52,216a20,20,0,1,1,20-20A20,20,0,0,1,52,216ZM88,93.75V62.25l112-28v31.5ZM180,184a20,20,0,1,1,20-20A20,20,0,0,1,180,184Z"/></svg>', ge = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M212.92,17.71a7.89,7.89,0,0,0-6.86-1.46l-128,32A8,8,0,0,0,72,56V166.1A36,36,0,1,0,88,196V102.25l112-28V134.1A36,36,0,1,0,216,164V24A8,8,0,0,0,212.92,17.71Z"/></svg>', pe = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M232.4,114.49,88.32,26.35a16,16,0,0,0-16.2-.3A15.86,15.86,0,0,0,64,39.87V216.13A15.94,15.94,0,0,0,80,232a16.07,16.07,0,0,0,8.36-2.35L232.4,141.51a15.81,15.81,0,0,0,0-27ZM80,215.94V40l143.83,88Z"/></svg>', fe = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm48.24-94.78-64-40A8,8,0,0,0,100,88v80a8,8,0,0,0,12.24,6.78l64-40a8,8,0,0,0,0-13.56ZM116,153.57V102.43L156.91,128Z"/></svg>', me = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm40.55,110.58-52,36A8,8,0,0,1,104,164V92a8,8,0,0,1,12.55-6.58l52,36a8,8,0,0,1,0,13.16Z"/></svg>', we = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M200,32H160a16,16,0,0,0-16,16V208a16,16,0,0,0,16,16h40a16,16,0,0,0,16-16V48A16,16,0,0,0,200,32Zm0,176H160V48h40ZM96,32H56A16,16,0,0,0,40,48V208a16,16,0,0,0,16,16H96a16,16,0,0,0,16-16V48A16,16,0,0,0,96,32Zm0,176H56V48H96Z"/></svg>', he = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M199.81,34a16,16,0,0,0-16.24.43L64,109.23V40a8,8,0,0,0-16,0V216a8,8,0,0,0,16,0V146.77l119.57,74.78A15.95,15.95,0,0,0,208,208.12V47.88A15.86,15.86,0,0,0,199.81,34ZM192,208,64.16,128,192,48.07Z"/></svg>', _e = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M200,32a8,8,0,0,0-8,8v69.23L72.43,34.45A15.95,15.95,0,0,0,48,47.88V208.12a16,16,0,0,0,24.43,13.43L192,146.77V216a8,8,0,0,0,16,0V40A8,8,0,0,0,200,32ZM64,207.93V48.05l127.84,80Z"/></svg>', xe = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M240,128a15.74,15.74,0,0,1-7.6,13.51L88.32,229.65a16,16,0,0,1-16.2.3A15.86,15.86,0,0,1,64,216.13V39.87a15.86,15.86,0,0,1,8.12-13.82,16,16,0,0,1,16.2.3L232.4,114.49A15.74,15.74,0,0,1,240,128Z"/></svg>', Ae = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M216,48V208a16,16,0,0,1-16,16H160a16,16,0,0,1-16-16V48a16,16,0,0,1,16-16h40A16,16,0,0,1,216,48ZM96,32H56A16,16,0,0,0,40,48V208a16,16,0,0,0,16,16H96a16,16,0,0,0,16-16V48A16,16,0,0,0,96,32Z"/></svg>', ye = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M208,47.88V208.12a16,16,0,0,1-24.43,13.43L64,146.77V216a8,8,0,0,1-16,0V40a8,8,0,0,1,16,0v69.23L183.57,34.45A15.95,15.95,0,0,1,208,47.88Z"/></svg>', Ze = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M208,40V216a8,8,0,0,1-16,0V146.77L72.43,221.55A15.95,15.95,0,0,1,48,208.12V47.88A15.95,15.95,0,0,1,72.43,34.45L192,109.23V40a8,8,0,0,1,16,0Z"/></svg>', Ve = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M24,128A72.08,72.08,0,0,1,96,56H204.69L194.34,45.66a8,8,0,0,1,11.32-11.32l24,24a8,8,0,0,1,0,11.32l-24,24a8,8,0,0,1-11.32-11.32L204.69,72H96a56.06,56.06,0,0,0-56,56,8,8,0,0,1-16,0Zm200-8a8,8,0,0,0-8,8,56.06,56.06,0,0,1-56,56H51.31l10.35-10.34a8,8,0,0,0-11.32-11.32l-24,24a8,8,0,0,0,0,11.32l24,24a8,8,0,0,0,11.32-11.32L51.31,200H160a72.08,72.08,0,0,0,72-72A8,8,0,0,0,224,120Z"/></svg>', Ce = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M24,128A72.08,72.08,0,0,1,96,56H204.69L194.34,45.66a8,8,0,0,1,11.32-11.32l24,24a8,8,0,0,1,0,11.32l-24,24a8,8,0,0,1-11.32-11.32L204.69,72H96a56.06,56.06,0,0,0-56,56,8,8,0,0,1-16,0Zm200-8a8,8,0,0,0-8,8,56.06,56.06,0,0,1-56,56H51.31l10.35-10.34a8,8,0,0,0-11.32-11.32l-24,24a8,8,0,0,0,0,11.32l24,24a8,8,0,0,0,11.32-11.32L51.31,200H160a72.08,72.08,0,0,0,72-72A8,8,0,0,0,224,120Zm-88,40a8,8,0,0,0,8-8V104a8,8,0,0,0-11.58-7.16l-16,8a8,8,0,1,0,7.16,14.31l4.42-2.21V152A8,8,0,0,0,136,160Z"/></svg>', He = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M237.66,178.34a8,8,0,0,1,0,11.32l-24,24a8,8,0,0,1-11.32-11.32L212.69,192H200.94a72.12,72.12,0,0,1-58.59-30.15l-41.72-58.4A56.1,56.1,0,0,0,55.06,80H32a8,8,0,0,1,0-16H55.06a72.12,72.12,0,0,1,58.59,30.15l41.72,58.4A56.1,56.1,0,0,0,200.94,176h11.75l-10.35-10.34a8,8,0,0,1,11.32-11.32ZM143,107a8,8,0,0,0,11.16-1.86l1.2-1.67A56.1,56.1,0,0,1,200.94,80h11.75L202.34,90.34a8,8,0,0,0,11.32,11.32l24-24a8,8,0,0,0,0-11.32l-24-24a8,8,0,0,0-11.32,11.32L212.69,64H200.94a72.12,72.12,0,0,0-58.59,30.15l-1.2,1.67A8,8,0,0,0,143,107Zm-30,42a8,8,0,0,0-11.16,1.86l-1.2,1.67A56.1,56.1,0,0,1,55.06,176H32a8,8,0,0,0,0,16H55.06a72.12,72.12,0,0,0,58.59-30.15l1.2-1.67A8,8,0,0,0,113,149Z"/></svg>', Me = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M32,64a8,8,0,0,1,8-8H216a8,8,0,0,1,0,16H40A8,8,0,0,1,32,64Zm8,72H160a8,8,0,0,0,0-16H40a8,8,0,0,0,0,16Zm72,48H40a8,8,0,0,0,0,16h72a8,8,0,0,0,0-16Zm135.66-57.7a8,8,0,0,1-10,5.36L208,122.75V192a32.05,32.05,0,1,1-16-27.69V112a8,8,0,0,1,10.3-7.66l40,12A8,8,0,0,1,247.66,126.3ZM192,192a16,16,0,1,0-16,16A16,16,0,0,0,192,192Z"/></svg>', ke = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M208,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM64,72H192a8,8,0,0,1,0,16H64a8,8,0,0,1,0-16Zm0,48h72a8,8,0,0,1,0,16H64a8,8,0,0,1,0-16Zm40,64H64a8,8,0,0,1,0-16h40a8,8,0,0,1,0,16Zm103.59-53.47a8,8,0,0,1-10.12,5.06L184,131.1V176a24,24,0,1,1-16-22.62V120a8,8,0,0,1,10.53-7.59l24,8A8,8,0,0,1,207.59,130.53Z"/></svg>', Le = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M155.51,24.81a8,8,0,0,0-8.42.88L77.25,80H32A16,16,0,0,0,16,96v64a16,16,0,0,0,16,16H77.25l69.84,54.31A8,8,0,0,0,160,224V32A8,8,0,0,0,155.51,24.81ZM32,96H72v64H32ZM144,207.64,88,164.09V91.91l56-43.55Zm54-106.08a40,40,0,0,1,0,52.88,8,8,0,0,1-12-10.58,24,24,0,0,0,0-31.72,8,8,0,0,1,12-10.58ZM248,128a79.9,79.9,0,0,1-20.37,53.34,8,8,0,0,1-11.92-10.67,64,64,0,0,0,0-85.33,8,8,0,1,1,11.92-10.67A79.83,79.83,0,0,1,248,128Z"/></svg>', Ee = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M155.51,24.81a8,8,0,0,0-8.42.88L77.25,80H32A16,16,0,0,0,16,96v64a16,16,0,0,0,16,16H77.25l69.84,54.31A8,8,0,0,0,160,224V32A8,8,0,0,0,155.51,24.81ZM32,96H72v64H32ZM144,207.64,88,164.09V91.91l56-43.55Zm101.66-61.3a8,8,0,0,1-11.32,11.32L216,139.31l-18.34,18.35a8,8,0,0,1-11.32-11.32L204.69,128l-18.35-18.34a8,8,0,0,1,11.32-11.32L216,116.69l18.34-18.35a8,8,0,0,1,11.32,11.32L227.31,128Z"/></svg>', Re = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M160,32.25V223.69a8.29,8.29,0,0,1-3.91,7.18,8,8,0,0,1-9-.56l-65.57-51A4,4,0,0,1,80,176.16V79.84a4,4,0,0,1,1.55-3.15l65.57-51a8,8,0,0,1,10,.16A8.27,8.27,0,0,1,160,32.25ZM60,80H32A16,16,0,0,0,16,96v64a16,16,0,0,0,16,16H60a4,4,0,0,0,4-4V84A4,4,0,0,0,60,80Zm126.77,20.84a8,8,0,0,0-.72,11.3,24,24,0,0,1,0,31.72,8,8,0,1,0,12,10.58,40,40,0,0,0,0-52.88A8,8,0,0,0,186.74,100.84Zm40.89-26.17a8,8,0,1,0-11.92,10.66,64,64,0,0,1,0,85.34,8,8,0,1,0,11.92,10.66,80,80,0,0,0,0-106.66Z"/></svg>', Se = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M245.66,146.34a8,8,0,0,1-11.32,11.32L216,139.31l-18.34,18.35a8,8,0,0,1-11.32-11.32L204.69,128l-18.35-18.34a8,8,0,0,1,11.32-11.32L216,116.69l18.34-18.35a8,8,0,0,1,11.32,11.32L227.31,128ZM60,80H32A16,16,0,0,0,16,96v64a16,16,0,0,0,16,16H60a4,4,0,0,0,4-4V84A4,4,0,0,0,60,80Zm97.15-54.15a8,8,0,0,0-10-.16l-65.57,51A4,4,0,0,0,80,79.84v96.32a4,4,0,0,0,1.55,3.15l65.57,51a8,8,0,0,0,9,.56,8.29,8.29,0,0,0,3.91-7.18V32.25A8.27,8.27,0,0,0,157.12,25.85Z"/></svg>', Be = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M141.66,133.66l-40,40a8,8,0,0,1-11.32-11.32L116.69,136H24a8,8,0,0,1,0-16h92.69L90.34,93.66a8,8,0,0,1,11.32-11.32l40,40A8,8,0,0,1,141.66,133.66ZM200,32H136a8,8,0,0,0,0,16h56V208H136a8,8,0,0,0,0,16h64a8,8,0,0,0,8-8V40A8,8,0,0,0,200,32Z"/></svg>', Pe = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M120,216a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V40a8,8,0,0,1,8-8h64a8,8,0,0,1,0,16H56V208h56A8,8,0,0,1,120,216Zm109.66-93.66-40-40a8,8,0,0,0-11.32,11.32L204.69,120H112a8,8,0,0,0,0,16h92.69l-26.35,26.34a8,8,0,0,0,11.32,11.32l40-40A8,8,0,0,0,229.66,122.34Z"/></svg>', Oe = {
  home: ii,
  launcher: ei,
  playtime: ri,
  chartLine: li,
  screenshots: ti,
  games: ai,
  addGame: oi,
  steam: si,
  steamLogo: ni,
  steamLogin: ci,
  steamAccounts: ui,
  steamInventory: bi,
  authenticator: W0,
  cloud: di,
  downloadPage: $0,
  settings: vi,
  about: U0,
  info: U0,
  fullscreen: gi,
  list: pi,
  coin: fi,
  shareNetwork: mi,
  grid: wi,
  pin: Ji,
  folder: hi,
  reset: _i,
  upload: Xi,
  warning: xi,
  key: W0,
  star: s0,
  starFilled: s0,
  starFill: le,
  starOutline: s0,
  chevronDown: Ai,
  download: $0,
  angleUp: yi,
  caretLeft: Zi,
  caretRight: Vi,
  image: Ci,
  imageBroken: Hi,
  arrowLeft: Mi,
  arrowRight: ki,
  search: Li,
  searchFilled: Ei,
  copy: Ri,
  edit: Si,
  trash: Bi,
  cloudDownload: Pi,
  cloudUpload: Oi,
  drive: ji,
  user: Ti,
  globe: Fi,
  externalLink: Di,
  monitor: Ni,
  chart: Ii,
  ranking: $i,
  clock: Wi,
  success: Ui,
  error: Yi,
  question: qi,
  close: Gi,
  check: zi,
  theme: Ki,
  themeAlt: Qi,
  bell: ie,
  archive: ee,
  save: re,
  eye: ne,
  eyeSlash: ce,
  heart: te,
  heartFilled: ae,
  bookmark: oe,
  bookmarkFilled: se,
  trophy: ue,
  trophyFill: be,
  rankingFilled: de,
  music: ve,
  musicFilled: ge,
  play: pe,
  pause: we,
  skipBack: he,
  skipForward: _e,
  playFilled: xe,
  playCircle: fe,
  playCircleFilled: me,
  pauseFilled: Ae,
  skipBackFilled: ye,
  skipForwardFilled: Ze,
  repeat: Ve,
  repeatOnce: Ce,
  shuffle: He,
  playlist: Me,
  playlistFilled: ke,
  speaker: Le,
  speakerMute: Ee,
  speakerFilled: Re,
  speakerMuteFilled: Se,
  signIn: Be,
  signOut: Pe
};
function K0({ name: t, className: o = "", size: n = 20, title: r }) {
  const l = Oe[t], i = {
    width: typeof n == "number" ? `${n}px` : n,
    height: typeof n == "number" ? `${n}px` : n
  };
  return /* @__PURE__ */ m.jsx(
    "span",
    {
      className: [
        "inline-flex shrink-0 items-center justify-center leading-none",
        "[&_svg]:block [&_svg]:h-full [&_svg]:w-full [&_svg]:fill-current [&_svg]:stroke-current",
        o
      ].join(" "),
      style: i,
      role: r ? "img" : void 0,
      "aria-hidden": r ? void 0 : !0,
      "aria-label": r,
      dangerouslySetInnerHTML: { __html: l }
    }
  );
}
const je = "app-surface app-glass-floating", Te = "app-surface app-glass-control", Fe = "app-surface app-glass-floating", De = "app-glass-menu-item";
function Q0(t) {
  return t.filter(Boolean).join(" ");
}
const Ne = je, J0 = Te, Ie = Fe, $e = De;
function We({ className: t = "", children: o, ...n }) {
  return /* @__PURE__ */ m.jsx("div", { className: Q0([Ne, t]), ...n, children: o });
}
const Ue = q0(function({ className: o = "", children: n, ...r }, l) {
  return /* @__PURE__ */ m.jsx("div", { ref: l, className: Q0([Ie, o]), ...r, children: n });
});
function Xe({
  open: t,
  onClose: o,
  title: n,
  children: r,
  actions: l,
  className: i = "",
  size: s = "md"
}) {
  const [g, w] = $(!1), [L, A] = $(!1), y = u0(null);
  b0(() => {
    if (t)
      A(!0), w(!1);
    else if (L) {
      w(!0);
      const M = setTimeout(() => A(!1), 180);
      return () => clearTimeout(M);
    }
  }, [t]);
  const H = G0(() => {
    w(!0), setTimeout(() => o(), 150);
  }, [o]);
  if (!L) return null;
  t && (y.current = { title: n, children: r, actions: l });
  const h = y.current ?? { title: n, children: r, actions: l }, S = s === "lg" ? "w-[min(92vw,680px)] max-h-[85vh]" : "w-[300px]", E = /* @__PURE__ */ m.jsx(
    "div",
    {
      className: `fixed inset-0 z-50 flex items-center justify-center soft-backdrop ${g ? "animate-fade-out" : "animate-fade-in"}`,
      onClick: (M) => {
        M.target === M.currentTarget && H();
      },
      children: /* @__PURE__ */ m.jsxs(
        We,
        {
          className: `relative ${S} rounded-[20px] shadow-[20px_20px_30px_rgba(0,0,0,0.068)] flex flex-col items-center gap-5 p-[30px] ${g ? "animate-fade-out" : "animate-scale-in"} ${i}`,
          onClick: (M) => M.stopPropagation(),
          children: [
            /* @__PURE__ */ m.jsx(
              "button",
              {
                onClick: H,
                className: "absolute top-5 right-5 flex items-center justify-center border-none bg-transparent cursor-pointer group",
                children: /* @__PURE__ */ m.jsx(K0, { name: "close", size: 20, className: "text-[#afafaf] group-hover:text-black dark:group-hover:text-white transition-colors" })
              }
            ),
            /* @__PURE__ */ m.jsxs("div", { className: `w-full flex flex-col gap-[5px] ${s === "lg" ? "min-h-0 overflow-y-auto" : ""}`, children: [
              h.title && /* @__PURE__ */ m.jsx("p", { className: "text-[20px] font-bold text-[rgb(27,27,27)] dark:text-foreground", children: h.title }),
              /* @__PURE__ */ m.jsx("div", { className: "font-light text-[rgb(102,102,102)] dark:text-muted-foreground", children: h.children })
            ] }),
            h.actions && /* @__PURE__ */ m.jsx("div", { className: "w-full flex items-center justify-center gap-[10px]", children: h.actions })
          ]
        }
      )
    }
  );
  return z0(E, document.body);
}
function ir({
  options: t,
  value: o,
  onChange: n,
  name: r,
  className: l = ""
}) {
  var y, H;
  const [i, s] = $(!1), g = u0(null), [w, L] = $(null), A = ((y = t.find((h) => h.value === o)) == null ? void 0 : y.label) || ((H = t[0]) == null ? void 0 : H.label) || "";
  return b0(() => {
    if (!i) return;
    const h = () => {
      const E = g.current;
      if (!E) return;
      const M = E.getBoundingClientRect();
      L({ left: M.left, top: M.bottom + 4, width: M.width });
    };
    h();
    const S = (E) => {
      g.current && !g.current.contains(E.target) && s(!1);
    };
    return window.addEventListener("resize", h), window.addEventListener("scroll", h, !0), document.addEventListener("mousedown", S), () => {
      window.removeEventListener("resize", h), window.removeEventListener("scroll", h, !0), document.removeEventListener("mousedown", S);
    };
  }, [i]), // 打开时把容器 z-index 提到最高，避免多个下拉垂直排列时被后面容器（同为 z-100）遮挡面板
  /* @__PURE__ */ m.jsxs("div", { ref: g, className: `relative select-none w-fit ${i ? "z-[200]" : "z-[100]"} ${l}`.trim(), children: [
    /* @__PURE__ */ m.jsxs(
      "div",
      {
        onClick: () => s(!i),
        "data-open": i ? "true" : "false",
        className: `${J0} flex items-center justify-between gap-2 border border-foreground/20 px-3 py-[5px] rounded text-xs cursor-pointer min-w-[100px] text-foreground`,
        children: [
          /* @__PURE__ */ m.jsx("span", { children: A }),
          /* @__PURE__ */ m.jsx(
            K0,
            {
              name: "chevronDown",
              size: 12,
              className: `text-foreground transition-transform duration-300 ${i ? "rotate-180" : ""}`
            }
          )
        ]
      }
    ),
    z0(
      /* @__PURE__ */ m.jsx(
        Ue,
        {
          className: [
            "fixed flex flex-col gap-0.5 rounded border border-foreground/10 p-1 shadow-lg z-[9999]",
            // 选项过多时限制高度并滚动（约 10 行），避免撑开页面滚动区域
            "max-h-[286px] overflow-y-auto",
            "transition-all duration-300 ease-out",
            i ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-1 pointer-events-none"
          ].join(" "),
          style: w ? { left: w.left, top: w.top, width: w.width } : void 0,
          children: t.map((h) => /* @__PURE__ */ m.jsx(
            "button",
            {
              onClick: () => {
                n(h.value), s(!1);
              },
              className: [
                `${$e} text-left rounded px-3 py-[5px] text-xs transition-colors duration-300`,
                "text-foreground hover:bg-secondary",
                o === h.value ? "bg-secondary font-medium" : ""
              ].join(" "),
              children: h.label
            },
            h.value
          ))
        }
      ),
      document.body
    )
  ] });
}
function er({
  min: t,
  max: o,
  step: n = 1,
  value: r,
  onChange: l,
  className: i = ""
}) {
  const s = o === t ? 0 : (r - t) / (o - t) * 100;
  return /* @__PURE__ */ m.jsx(
    "label",
    {
      className: [
        "inline-flex w-full cursor-pointer items-center",
        "[--slider-height:6px] [--slider-fill:hsl(var(--primary))] [--slider-track:hsl(var(--border)/0.88)] [--slider-track-hover:hsl(var(--primary)/0.2)] [--slider-ring:hsl(var(--primary)/0.18)] [--slider-outline:hsl(var(--border)/0.9)]",
        i
      ].join(" "),
      children: /* @__PURE__ */ m.jsx(
        "input",
        {
          type: "range",
          min: t,
          max: o,
          step: n,
          value: r,
          onChange: (g) => l(Number(g.target.value)),
          className: "app-glass-slider slider-level h-[var(--slider-height)] w-full cursor-pointer appearance-none rounded-full bg-[var(--slider-track)] shadow-[inset_0_0_0_1px_var(--slider-outline)] transition-[height,box-shadow,background] duration-150 hover:h-[calc(var(--slider-height)*2)] hover:bg-[var(--slider-track-hover)] hover:shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.32)] focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--slider-ring),inset_0_0_0_1px_hsl(var(--primary)/0.4)] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-0 [&::-webkit-slider-thumb]:h-0 [&::-moz-range-thumb]:w-0 [&::-moz-range-thumb]:h-0 [&::-moz-range-thumb]:border-0",
          style: {
            background: `linear-gradient(to right, var(--slider-fill) 0%, var(--slider-fill) ${s}%, var(--slider-track) ${s}%, var(--slider-track) 100%)`
          }
        }
      )
    }
  );
}
const rr = q0(
  function({ className: o = "", density: n = "default", ...r }, l) {
    return /* @__PURE__ */ m.jsx(
      "input",
      {
        ref: l,
        className: [
          "w-full rounded border border-border",
          n === "compact" ? "px-2 py-0.5 text-xs" : "px-3 py-2 text-sm",
          "border border-border",
          `${J0} text-foreground placeholder:text-muted-foreground`,
          "shadow-[0px_0px_14px_-20px] shadow-black/10",
          "transition-[border-color,box-shadow,color] duration-150 ease-out",
          "hover:border-primary/20",
          "focus:outline-none focus:border-primary/35 focus:ring-2 focus:ring-primary/15",
          "disabled:opacity-60 disabled:cursor-not-allowed",
          "read-only:text-muted-foreground read-only:bg-primary/[0.02]",
          o
        ].join(" "),
        ...r
      }
    );
  }
);
function lr({ on: t, onChange: o, id: n }) {
  const r = n || c0.useId();
  return /* @__PURE__ */ m.jsxs("div", { className: "relative inline-block w-[42px] h-[22px]", children: [
    /* @__PURE__ */ m.jsx(
      "input",
      {
        id: r,
        type: "checkbox",
        checked: t,
        onChange: (l) => o(l.target.checked),
        className: "sr-only"
      }
    ),
    /* @__PURE__ */ m.jsx(
      "label",
      {
        htmlFor: r,
        className: [
          "app-glass-toggle-track absolute inset-0 overflow-hidden rounded-[11px] cursor-pointer transition-all duration-300 border",
          t ? "bg-primary/20 border-primary/30 shadow-[0_0_0_1px_hsl(var(--primary)/0.08)]" : "bg-muted/80 border-border"
        ].join(" "),
        children: /* @__PURE__ */ m.jsx(
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
const tr = {
  createElement: T1,
  Fragment: j1,
  useCallback: G0,
  useContext: O1,
  useEffect: b0,
  useRef: u0,
  useState: $
}, Ye = 1, ar = ["core.read", "core.backup", "events", "ui", "music", "bilibili"];
class Y0 extends Error {
  constructor(n) {
    super(n.message);
    G(this, "kind");
    G(this, "retryable");
    G(this, "externalUrl");
    this.name = "BiliSdkError", this.kind = n.kind, this.retryable = n.retryable, this.externalUrl = n.externalUrl;
  }
}
const z = [], K = [], J = /* @__PURE__ */ new Map();
function or(t) {
  for (let o = z.length - 1; o >= 0; o--)
    z[o].pluginId === t && z.splice(o, 1);
  for (let o = K.length - 1; o >= 0; o--)
    K[o].pluginId === t && K.splice(o, 1);
}
async function sr(t) {
  const o = J.get(t) ?? [], n = [];
  for (const r of o)
    try {
      await r();
    } catch (l) {
      n.push(l);
    }
  return n;
}
function nr(t) {
  J.delete(t);
}
function cr(t, o) {
  const n = new Set(o);
  function r(i, s) {
    if (!n.has(i))
      throw new Error(
        `PermissionDenied: plugin "${t}" lacks permission "${i}" (${s})`
      );
  }
  function l(i, s) {
    return b(i, s).catch((g) => {
      throw qe(g);
    });
  }
  return {
    apiVersion: Ye,
    log: (...i) => console.log(`[plugin:${t}]`, ...i),
    ui: {
      registerPage(i) {
        r("ui", "ui.registerPage"), z.push({ pluginId: t, ...i });
      },
      registerSettingsSection(i) {
        r("ui", "ui.registerSettingsSection"), K.push({ pluginId: t, ...i });
      },
      notify(i) {
        r("ui", "ui.notify");
      }
    },
    core: {
      listGames() {
        return r("core.read", "core.listGames"), b("get_games");
      },
      listSnapshots(i) {
        return r("core.read", "core.listSnapshots"), b("get_snapshots", { gameId: i });
      },
      getGame(i) {
        return r("core.read", "core.getGame"), b("get_game_by_id", { gameId: i });
      },
      triggerBackup(i) {
        return r("core.backup", "core.triggerBackup"), b("backup_now", { gameId: i });
      }
    },
    events: {
      on(i, s) {
        r("events", "events.on"), q1(t, i, s);
      },
      off(i, s) {
        r("events", "events.off"), Y1(i, s);
      }
    },
    storage: {
      get() {
        return b("read_plugin_config", { id: t });
      },
      set(i) {
        return b("write_plugin_config", { id: t, data: i });
      }
    },
    lifecycle: {
      onDispose(i) {
        const s = J.get(t) ?? [];
        s.push(i), J.set(t, s);
      }
    },
    music: {
      openLoginWindow() {
        return r("music", "music.openLoginWindow"), b("music_open_login_window");
      },
      loginQrKey() {
        return r("music", "music.loginQrKey"), b("music_login_qr_key");
      },
      loginQrCheck(i) {
        return r("music", "music.loginQrCheck"), b("music_login_qr_check", { key: i });
      },
      sendLoginCaptcha(i, s) {
        return r("music", "music.sendLoginCaptcha"), b("music_login_send_captcha", { phone: i, countrycode: s });
      },
      loginCellphone(i, s, g) {
        return r("music", "music.loginCellphone"), b("music_login_cellphone", { phone: i, captcha: s, countrycode: g });
      },
      loginStatus() {
        return r("music", "music.loginStatus"), b("music_login_status");
      },
      logout() {
        return r("music", "music.logout"), b("music_logout");
      },
      search(i, s) {
        return r("music", "music.search"), b("music_search", { keywords: i, limit: s });
      },
      userPlaylists() {
        return r("music", "music.userPlaylists"), b("music_user_playlists");
      },
      likedList() {
        return r("music", "music.likedList"), b("music_likelist");
      },
      likeSong(i, s) {
        return r("music", "music.likeSong"), b("music_like", { id: i, like: s });
      },
      subscribePlaylist(i, s) {
        return r("music", "music.subscribePlaylist"), b("music_playlist_subscribe", { id: i, subscribe: s });
      },
      recommendSongs() {
        return r("music", "music.recommendSongs"), b("music_recommend_songs");
      },
      topPlaylists() {
        return r("music", "music.topPlaylists"), b("music_toplists");
      },
      personalizedPlaylists() {
        return r("music", "music.personalizedPlaylists"), b("music_personalized_playlists");
      },
      searchPlaylists(i, s) {
        return r("music", "music.searchPlaylists"), b("music_playlist_search", { keywords: i, limit: s });
      },
      searchAlbums(i, s) {
        return r("music", "music.searchAlbums"), b("music_album_search", { keywords: i, limit: s });
      },
      searchArtists(i, s) {
        return r("music", "music.searchArtists"), b("music_artist_search", { keywords: i, limit: s });
      },
      albumSongs(i) {
        return r("music", "music.albumSongs"), b("music_album_songs", { id: i });
      },
      artistSongs(i) {
        return r("music", "music.artistSongs"), b("music_artist_songs", { id: i });
      },
      playlistTracks(i) {
        return r("music", "music.playlistTracks"), b("music_playlist_tracks", { id: i });
      },
      playlistTracksRange(i, s, g) {
        return r("music", "music.playlistTracksRange"), b("music_playlist_tracks_range", { id: i, start: s, count: g });
      },
      songUrl(i, s) {
        return r("music", "music.songUrl"), b("music_song_url", s ? { id: i, quality: s } : { id: i });
      },
      lyric(i) {
        return r("music", "music.lyric"), b("music_lyric", { id: i });
      },
      proxyPort() {
        return r("music", "music.proxyPort"), b("music_proxy_port");
      },
      async audioProxyUrl(i) {
        return r("music", "music.audioProxyUrl"), `http://127.0.0.1:${await b("music_proxy_port")}/audio?url=${encodeURIComponent(i)}`;
      },
      async coverProxyUrl(i) {
        return r("music", "music.coverProxyUrl"), i ? `http://127.0.0.1:${await b("music_proxy_port")}/cover?url=${encodeURIComponent(i)}` : "";
      },
      clearCoverCache() {
        return r("music", "music.clearCoverCache"), b("music_clear_cover_cache");
      }
    },
    bilibili: {
      account: {
        loginQrKey() {
          return r("bilibili", "bilibili.account.loginQrKey"), l("bilibili_login_qr_key");
        },
        loginQrCheck(i) {
          return r("bilibili", "bilibili.account.loginQrCheck"), l("bilibili_login_qr_check", { key: i });
        },
        loginStatus() {
          return r("bilibili", "bilibili.account.loginStatus"), l("bilibili_login_status");
        },
        logout() {
          return r("bilibili", "bilibili.account.logout"), l("bilibili_logout");
        }
      },
      home: {
        recommendVideos(i, s) {
          return r("bilibili", "bilibili.home.recommendVideos"), l("bilibili_recommend_videos", { page: i, refresh: s });
        },
        searchVideos(i, s, g) {
          return r("bilibili", "bilibili.home.searchVideos"), l("bilibili_search_videos", { keywords: i, page: s, refresh: g });
        },
        popularVideos(i, s) {
          return r("bilibili", "bilibili.home.popularVideos"), l("bilibili_popular_videos", { page: i, refresh: s });
        }
      },
      video: {
        detail(i) {
          return r("bilibili", "bilibili.video.detail"), l("bilibili_video_detail", i);
        },
        related(i) {
          return r("bilibili", "bilibili.video.related"), l("bilibili_related_videos", i);
        },
        openExternal(i) {
          return r("bilibili", "bilibili.video.openExternal"), l("bilibili_open_video", { bvid: i });
        }
      },
      playback: {
        createPlayback(i) {
          return r("bilibili", "bilibili.playback.createPlayback"), l("bilibili_create_playback", i);
        },
        saveLocalProgress(i) {
          return r("bilibili", "bilibili.playback.saveLocalProgress"), l("bilibili_save_local_progress", i);
        },
        loadLocalProgress(i) {
          return r("bilibili", "bilibili.playback.loadLocalProgress"), l("bilibili_load_local_progress", i);
        },
        reportProgress(i) {
          return r("bilibili", "bilibili.playback.reportProgress"), l("bilibili_report_progress", i);
        }
      },
      danmaku: {
        list(i) {
          return r("bilibili", "bilibili.danmaku.list"), l("bilibili_danmaku_list", i);
        },
        segment(i) {
          return r("bilibili", "bilibili.danmaku.segment"), l("bilibili_danmaku_segment", i);
        },
        thumbup(i) {
          return r("bilibili", "bilibili.danmaku.thumbup"), l("bilibili_danmaku_thumbup", i);
        },
        report(i) {
          return r("bilibili", "bilibili.danmaku.report"), l("bilibili_danmaku_report", i);
        },
        recall(i) {
          return r("bilibili", "bilibili.danmaku.recall"), l("bilibili_danmaku_recall", i);
        },
        send(i) {
          return r("bilibili", "bilibili.danmaku.send"), l("bilibili_send_danmaku", i);
        }
      },
      comment: {
        list(i) {
          return r("bilibili", "bilibili.comment.list"), l("bilibili_comment_list", { ...i, oid: String(i.oid) });
        },
        replies(i) {
          return r("bilibili", "bilibili.comment.replies"), l("bilibili_comment_replies", { ...i, oid: String(i.oid) });
        },
        add(i) {
          return r("bilibili", "bilibili.comment.add"), l("bilibili_comment_add", { ...i, oid: String(i.oid) });
        },
        like(i) {
          return r("bilibili", "bilibili.comment.like"), l("bilibili_comment_like", { ...i, oid: String(i.oid) });
        },
        dislike(i) {
          return r("bilibili", "bilibili.comment.dislike"), l("bilibili_comment_dislike", { ...i, oid: String(i.oid) });
        },
        delete(i) {
          return r("bilibili", "bilibili.comment.delete"), l("bilibili_comment_delete", { ...i, oid: String(i.oid) });
        },
        top(i) {
          return r("bilibili", "bilibili.comment.top"), l("bilibili_comment_top", { ...i, oid: String(i.oid) });
        },
        report(i) {
          return r("bilibili", "bilibili.comment.report"), l("bilibili_comment_report", { ...i, oid: String(i.oid) });
        }
      },
      library: {
        historyList(i) {
          return r("bilibili", "bilibili.library.historyList"), l("bilibili_history_list", { page: i });
        },
        toViewList() {
          return r("bilibili", "bilibili.library.toViewList"), l("bilibili_toview_list");
        },
        addToView(i) {
          return r("bilibili", "bilibili.library.addToView"), l("bilibili_toview_add", i);
        },
        removeToView(i) {
          return r("bilibili", "bilibili.library.removeToView"), l("bilibili_toview_remove", i);
        },
        favoriteFolders(i) {
          return r("bilibili", "bilibili.library.favoriteFolders"), l("bilibili_favorite_folders", { rid: i });
        },
        favoriteItems(i, s) {
          return r("bilibili", "bilibili.library.favoriteItems"), l("bilibili_favorite_items", { mediaId: i, page: s });
        },
        favoriteVideo(i) {
          return r("bilibili", "bilibili.library.favoriteVideo"), l("bilibili_favorite_video", {
            rid: i.rid,
            addMediaIds: i.addMediaIds ?? [],
            delMediaIds: i.delMediaIds ?? []
          });
        }
      },
      interaction: {
        state(i) {
          return r("bilibili", "bilibili.interaction.state"), l("bilibili_interaction_state", i);
        },
        like(i) {
          return r("bilibili", "bilibili.interaction.like"), l("bilibili_like_video", i);
        },
        coin(i) {
          return r("bilibili", "bilibili.interaction.coin"), l("bilibili_coin_video", i);
        },
        favorite(i) {
          return r("bilibili", "bilibili.interaction.favorite"), l("bilibili_favorite_video_interaction", {
            rid: i.rid,
            addMediaIds: i.addMediaIds ?? [],
            delMediaIds: i.delMediaIds ?? []
          });
        },
        toView(i) {
          return r("bilibili", "bilibili.interaction.toView"), l("bilibili_toview_video_interaction", i);
        },
        followOwner(i) {
          return r("bilibili", "bilibili.interaction.followOwner"), l("bilibili_follow_owner", i);
        },
        copyShareLink(i) {
          return r("bilibili", "bilibili.interaction.copyShareLink"), l("bilibili_copy_share_link", i);
        },
        openReport(i) {
          return r("bilibili", "bilibili.interaction.openReport"), l("bilibili_open_report", i);
        }
      },
      cache: {
        saveScreenshot(i) {
          return r("bilibili", "bilibili.cache.saveScreenshot"), l("bilibili_save_screenshot", i);
        },
        openScreenshotFolder() {
          return r("bilibili", "bilibili.cache.openScreenshotFolder"), l("bilibili_open_screenshot_folder");
        },
        clearCache() {
          return r("bilibili", "bilibili.cache.clearCache"), l("bilibili_clear_cache");
        },
        async coverProxyUrl(i) {
          return r("bilibili", "bilibili.cache.coverProxyUrl"), i ? `http://127.0.0.1:${await l("bilibili_proxy_port")}/bilibili/cover/${Ge(i)}?url=${encodeURIComponent(i)}` : "";
        }
      },
      ranking: {
        videos(i) {
          return r("bilibili", "bilibili.ranking.videos"), l("bilibili_ranking_videos", { rid: i });
        },
        weeks() {
          return r("bilibili", "bilibili.ranking.weeks"), l("bilibili_weekly_series_list");
        },
        weekDetail(i) {
          return r("bilibili", "bilibili.ranking.weekDetail"), l("bilibili_weekly_series_one", { number: i });
        },
        precious() {
          return r("bilibili", "bilibili.ranking.precious"), l("bilibili_precious_videos");
        }
      },
      search: {
        suggest(i) {
          return r("bilibili", "bilibili.search.suggest"), l("bilibili_search_suggest", { keyword: i });
        },
        hotwords() {
          return r("bilibili", "bilibili.search.hotwords"), l("bilibili_search_hotwords");
        }
      },
      fav: {
        createFolder({ title: i }) {
          return r("bilibili", "bilibili.fav.createFolder"), l("bilibili_fav_folder_create", { title: i });
        },
        editFolder({ mediaId: i, title: s }) {
          return r("bilibili", "bilibili.fav.editFolder"), l("bilibili_fav_folder_edit", { mediaId: i, title: s });
        },
        deleteFolders({ mediaIds: i }) {
          return r("bilibili", "bilibili.fav.deleteFolders"), l("bilibili_fav_folder_delete", { mediaIds: i });
        },
        deleteResources({ mediaId: i, resources: s }) {
          return r("bilibili", "bilibili.fav.deleteResources"), l("bilibili_fav_resource_delete", { mediaId: i, resources: s });
        },
        moveResources({ srcMediaId: i, tarMediaId: s, resources: g }) {
          return r("bilibili", "bilibili.fav.moveResources"), l("bilibili_fav_resource_move", { srcMediaId: i, tarMediaId: s, resources: g });
        },
        copyResources({ srcMediaId: i, tarMediaId: s, resources: g }) {
          return r("bilibili", "bilibili.fav.copyResources"), l("bilibili_fav_resource_copy", { srcMediaId: i, tarMediaId: s, resources: g });
        },
        cleanResources({ mediaId: i }) {
          return r("bilibili", "bilibili.fav.cleanResources"), l("bilibili_fav_resource_clean", { mediaId: i });
        }
      },
      user: {
        space({ mid: i }) {
          return r("bilibili", "bilibili.user.space"), l("bilibili_user_space", { mid: i });
        },
        videos({ mid: i, page: s }) {
          return r("bilibili", "bilibili.user.videos"), l("bilibili_user_videos", { mid: i, page: s });
        },
        follow({ mid: i, follow: s }) {
          return r("bilibili", "bilibili.user.follow"), l("bilibili_user_follow", { mid: i, follow: s });
        }
      },
      season: {
        detail({ seasonId: i }) {
          return r("bilibili", "bilibili.season.detail"), l("bilibili_season_detail", { seasonId: i });
        },
        follow({ seasonId: i, follow: s }) {
          return r("bilibili", "bilibili.season.follow"), l("bilibili_season_follow", { seasonId: i, follow: s });
        },
        pgcTabs({ kind: i }) {
          return r("bilibili", "bilibili.season.pgcTabs"), l("bilibili_pgc_tabs", { kind: i });
        },
        pgcIndex(i) {
          return r("bilibili", "bilibili.season.pgcIndex"), l("bilibili_pgc_index", i);
        },
        pgcRank({ seasonType: i }) {
          return r("bilibili", "bilibili.season.pgcRank"), l("bilibili_pgc_rank", { seasonType: i });
        },
        followList({ page: i, cinema: s }) {
          return r("bilibili", "bilibili.season.followList"), l("bilibili_bangumi_follow_list", { page: i, cinema: s });
        }
      },
      live: {
        room(i) {
          return r("bilibili", "bilibili.live.room"), l("bilibili_live_room", i);
        },
        stream(i) {
          return r("bilibili", "bilibili.live.stream"), l("bilibili_live_stream", i);
        },
        recommend(i) {
          return r("bilibili", "bilibili.live.recommend"), l("bilibili_live_recommend", i);
        },
        areas() {
          return r("bilibili", "bilibili.live.areas"), l("bilibili_live_areas");
        },
        rooms(i) {
          return r("bilibili", "bilibili.live.rooms"), l("bilibili_live_rooms", i);
        },
        sendDanmaku(i) {
          return r("bilibili", "bilibili.live.sendDanmaku"), l("bilibili_live_send_danmaku", i);
        },
        heartbeat(i) {
          return r("bilibili", "bilibili.live.heartbeat"), l("bilibili_live_heartbeat", i);
        },
        async danmakuWsUrl({ roomId: i }) {
          return r("bilibili", "bilibili.live.danmakuWsUrl"), `ws://127.0.0.1:${await l("bilibili_proxy_port")}/bilibili/live/${i}/danmaku`;
        }
      },
      dynamic: {
        all(i) {
          return r("bilibili", "bilibili.dynamic.all"), l("bilibili_dynamic_all", i);
        },
        detail(i) {
          return r("bilibili", "bilibili.dynamic.detail"), l("bilibili_dynamic_detail", i);
        },
        like(i) {
          return r("bilibili", "bilibili.dynamic.like"), l("bilibili_dynamic_like", i);
        },
        createText(i) {
          return r("bilibili", "bilibili.dynamic.createText"), l("bilibili_dynamic_create_text", i);
        },
        top(i) {
          return r("bilibili", "bilibili.dynamic.top"), l("bilibili_dynamic_top", i);
        },
        forwards(i) {
          return r("bilibili", "bilibili.dynamic.forwards"), l("bilibili_dynamic_forwards", i);
        }
      },
      message: {
        sessions(i) {
          return r("bilibili", "bilibili.message.sessions"), l("bilibili_message_sessions", i);
        },
        history(i) {
          return r("bilibili", "bilibili.message.history"), l("bilibili_message_history", i);
        },
        send(i) {
          return r("bilibili", "bilibili.message.send"), l("bilibili_message_send", i);
        },
        unread() {
          return r("bilibili", "bilibili.message.unread"), l("bilibili_message_unread");
        },
        replyFeed(i) {
          return r("bilibili", "bilibili.message.replyFeed"), l("bilibili_message_reply_feed", i);
        }
      },
      note: {
        list(i) {
          return r("bilibili", "bilibili.note.list"), l("bilibili_note_list", i);
        },
        detail(i) {
          return r("bilibili", "bilibili.note.detail"), l("bilibili_note_detail", i);
        }
      },
      article: {
        view(i) {
          return r("bilibili", "bilibili.article.view"), l("bilibili_article_view", i);
        },
        like(i) {
          return r("bilibili", "bilibili.article.like"), l("bilibili_article_like", i);
        },
        coin(i) {
          return r("bilibili", "bilibili.article.coin"), l("bilibili_article_coin", i);
        },
        list(i) {
          return r("bilibili", "bilibili.article.list"), l("bilibili_article_list", i);
        },
        search(i) {
          return r("bilibili", "bilibili.article.search"), l("bilibili_search_articles", i);
        }
      }
    }
  };
}
function qe(t) {
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
function Ge(t) {
  let o = 2166136261;
  for (let n = 0; n < t.length; n += 1)
    o ^= t.charCodeAt(n), o = Math.imul(o, 16777619);
  return `c${(o >>> 0).toString(16)}`;
}
export {
  ar as ALL_PERMISSIONS,
  Y0 as BiliSdkError,
  Je as Button,
  Xe as Dialog,
  dr as Fragment,
  K0 as Icon,
  ir as Select,
  er as Slider,
  rr as TextField,
  lr as Toggle,
  Ye as apiVersion,
  nr as clearPluginDispose,
  or as clearPluginRegistrations,
  vr as createElement,
  cr as createPluginSdk,
  _r as createPortal,
  tr as default,
  z as registeredPages,
  K as registeredSettingsSections,
  sr as runPluginDispose,
  gr as useCallback,
  pr as useContext,
  fr as useEffect,
  mr as useRef,
  wr as useState
};
