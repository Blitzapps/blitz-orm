import * as acorn from 'acorn';

const STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/gm;
const STRIP_KEYWORDS = /(\s*async\s*|\s*function\s*|\s*\(\s*|\s*\)\s*=>|\s*\)\s*\{)/;

export const getParamNames = (func: (...args: any[]) => any): string[] => {
  const fnStr: string = func.toString().replace(STRIP_COMMENTS, '').trim();
  // Remove function keywords and split at the first => or { to isolate parameters
  const fnBodyStr: string = fnStr.split('=>')[0].split('{')[0].replace(STRIP_KEYWORDS, '').trim();
  const paramsBlock = fnBodyStr.substring(fnBodyStr.indexOf('(') + 1, fnBodyStr.lastIndexOf(')')).trim();

  if (!paramsBlock) {
    return [];
  }

  // Match including destructured parameters with special characters
  const paramsMatch = paramsBlock.match(/(\{[^}]*\}|[^,]+)/g) || [];

  return paramsMatch
    .flatMap((param) => {
      // Remove leading/trailing braces and split based on comma outside of quotes
      if (param.includes('{') && param.includes('}')) {
        const destructuredParams = param.replace(/^\{|\}$/g, '').match(/(?:[^,"']+|"[^"]*"|'[^']*')+/g) || [];
        return destructuredParams.map((p) =>
          p
            .split(':')[0]
            .trim()
            .replace(/['"[\]]/g, ''),
        );
      }
      return param.trim();
    })
    .filter(Boolean);
};

export const getDependencies = (fn: (...args: any[]) => void) => {
  const code = fn.toString();
  const ast = acorn.parse(code, { ecmaVersion: 2020 });
  let current: string[] = [];
  let parent: string[] = [];
  let context: string[] = [];
  const statement = ast.body.find((i) => i.type === 'ExpressionStatement') as acorn.ExpressionStatement | undefined;
  if (statement) {
    const fn = statement.expression;
    if (fn.type === 'ArrowFunctionExpression' || fn.type === 'FunctionExpression') {
      const [cur, par, ctx] = fn.params;
      current = getKeys(cur);
      parent = getKeys(par);
      context = getKeys(ctx);
    }
  }
  return { current, parent, context };
};

const getKeys = (pat?: acorn.Pattern): string[] => {
  const keys: string[] = [];
  if (pat?.type === 'ObjectPattern') {
    for (const p of pat?.properties ?? []) {
      if (p.type === 'Property') {
        if (p.key.type === 'Identifier') {
          keys.push(p.key.name);
        }
      }
    }
  }
  return keys;
};
