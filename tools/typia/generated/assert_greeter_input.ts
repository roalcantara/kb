import * as __typia_transform__isTypeUint32 from "typia/lib/internal/_isTypeUint32";
import * as __typia_transform__assertGuard from "typia/lib/internal/_assertGuard";
import type { GreeterInput } from "../../../apps/kb/src/core/greeter/greeter.input";
export const assertGreeterInput = (() => { const _io0 = (input: any): boolean => "string" === typeof input.name && 1 <= input.name.length && (undefined === input.times || "number" === typeof input.times && (__typia_transform__isTypeUint32._isTypeUint32(input.times) && 1 <= input.times)); const _ao0 = (input: any, _path: string, _exceptionable: boolean = true): boolean => ("string" === typeof input.name && (1 <= input.name.length || __typia_transform__assertGuard._assertGuard(_exceptionable, {
    method: "typia.createAssert",
    path: _path + ".name",
    expected: "string & MinLength<1>",
    value: input.name
}, _errorFactory)) || __typia_transform__assertGuard._assertGuard(_exceptionable, {
    method: "typia.createAssert",
    path: _path + ".name",
    expected: "(string & MinLength<1>)",
    value: input.name
}, _errorFactory)) && (undefined === input.times || "number" === typeof input.times && (__typia_transform__isTypeUint32._isTypeUint32(input.times) || __typia_transform__assertGuard._assertGuard(_exceptionable, {
    method: "typia.createAssert",
    path: _path + ".times",
    expected: "number & Type<\"uint32\">",
    value: input.times
}, _errorFactory)) && (1 <= input.times || __typia_transform__assertGuard._assertGuard(_exceptionable, {
    method: "typia.createAssert",
    path: _path + ".times",
    expected: "number & Minimum<1>",
    value: input.times
}, _errorFactory)) || __typia_transform__assertGuard._assertGuard(_exceptionable, {
    method: "typia.createAssert",
    path: _path + ".times",
    expected: "((number & Type<\"uint32\"> & Minimum<1>) | undefined)",
    value: input.times
}, _errorFactory)); const __is = (input: any): input is GreeterInput => "object" === typeof input && null !== input && _io0(input); let _errorFactory: any; return (input: any, errorFactory?: (p: import("typia").TypeGuardError.IProps) => Error): GreeterInput => {
    if (false === __is(input)) {
        _errorFactory = errorFactory;
        ((input: any, _path: string, _exceptionable: boolean = true) => ("object" === typeof input && null !== input || __typia_transform__assertGuard._assertGuard(true, {
            method: "typia.createAssert",
            path: _path + "",
            expected: "GreeterInput",
            value: input
        }, _errorFactory)) && _ao0(input, _path + "", true) || __typia_transform__assertGuard._assertGuard(true, {
            method: "typia.createAssert",
            path: _path + "",
            expected: "GreeterInput",
            value: input
        }, _errorFactory))(input, "$input", true);
    }
    return input;
}; })();
