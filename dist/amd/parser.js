define(['exports', './lexer', './ast'], function (exports, _lexer, _ast) {
  'use strict';

  var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } };

  var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

  Object.defineProperty(exports, '__esModule', {
    value: true
  });

  var EOF = new _lexer.Token(-1, null);

  var Parser = (function () {
    function Parser() {
      _classCallCheck(this, Parser);

      this.cache = {};
      this.lexer = new _lexer.Lexer();
    }

    _createClass(Parser, [{
      key: 'parse',
      value: function parse(input) {
        input = input || '';

        return this.cache[input] || (this.cache[input] = new ParserImplementation(this.lexer, input).parseChain());
      }
    }]);

    return Parser;
  })();

  exports.Parser = Parser;

  var ParserImplementation = (function () {
    function ParserImplementation(lexer, input) {
      _classCallCheck(this, ParserImplementation);

      this.index = 0;
      this.input = input;
      this.tokens = lexer.lex(input);
    }

    _createClass(ParserImplementation, [{
      key: 'peek',
      get: function () {
        return this.index < this.tokens.length ? this.tokens[this.index] : EOF;
      }
    }, {
      key: 'parseChain',
      value: function parseChain() {
        var isChain = false,
            expressions = [];

        while (this.optional(';')) {
          isChain = true;
        }

        while (this.index < this.tokens.length) {
          if (this.peek.text === ')' || this.peek.text === '}' || this.peek.text === ']') {
            this.error('Unconsumed token ' + this.peek.text);
          }

          var expr = this.parseValueConverter();
          expressions.push(expr);

          while (this.optional(';')) {
            isChain = true;
          }

          if (isChain && expr instanceof _ast.ValueConverter) {
            this.error('cannot have a value converter in a chain');
          }
        }

        return expressions.length === 1 ? expressions[0] : new _ast.Chain(expressions);
      }
    }, {
      key: 'parseValueConverter',
      value: function parseValueConverter() {
        var result = this.parseExpression();

        while (this.optional('|')) {
          var name = this.peek.text,
              args = [];

          this.advance();

          while (this.optional(':')) {
            args.push(this.parseExpression());
          }

          result = new _ast.ValueConverter(result, name, args, [result].concat(args));
        }

        return result;
      }
    }, {
      key: 'parseExpression',
      value: function parseExpression() {
        var start = this.peek.index,
            result = this.parseConditional();

        while (this.peek.text === '=') {
          if (!result.isAssignable) {
            var end = this.index < this.tokens.length ? this.peek.index : this.input.length;
            var expression = this.input.substring(start, end);

            this.error('Expression ' + expression + ' is not assignable');
          }

          this.expect('=');
          result = new _ast.Assign(result, this.parseConditional());
        }

        return result;
      }
    }, {
      key: 'parseConditional',
      value: function parseConditional() {
        var start = this.peek.index,
            result = this.parseLogicalOr();

        if (this.optional('?')) {
          var yes = this.parseExpression();

          if (!this.optional(':')) {
            var end = this.index < this.tokens.length ? this.peek.index : this.input.length;
            var expression = this.input.substring(start, end);

            this.error('Conditional expression ' + expression + ' requires all 3 expressions');
          }

          var no = this.parseExpression();
          result = new _ast.Conditional(result, yes, no);
        }

        return result;
      }
    }, {
      key: 'parseLogicalOr',
      value: function parseLogicalOr() {
        var result = this.parseLogicalAnd();

        while (this.optional('||')) {
          result = new _ast.Binary('||', result, this.parseLogicalAnd());
        }

        return result;
      }
    }, {
      key: 'parseLogicalAnd',
      value: function parseLogicalAnd() {
        var result = this.parseEquality();

        while (this.optional('&&')) {
          result = new _ast.Binary('&&', result, this.parseEquality());
        }

        return result;
      }
    }, {
      key: 'parseEquality',
      value: function parseEquality() {
        var result = this.parseRelational();

        while (true) {
          if (this.optional('==')) {
            result = new _ast.Binary('==', result, this.parseRelational());
          } else if (this.optional('!=')) {
            result = new _ast.Binary('!=', result, this.parseRelational());
          } else if (this.optional('===')) {
            result = new _ast.Binary('===', result, this.parseRelational());
          } else if (this.optional('!==')) {
            result = new _ast.Binary('!==', result, this.parseRelational());
          } else {
            return result;
          }
        }
      }
    }, {
      key: 'parseRelational',
      value: function parseRelational() {
        var result = this.parseAdditive();

        while (true) {
          if (this.optional('<')) {
            result = new _ast.Binary('<', result, this.parseAdditive());
          } else if (this.optional('>')) {
            result = new _ast.Binary('>', result, this.parseAdditive());
          } else if (this.optional('<=')) {
            result = new _ast.Binary('<=', result, this.parseAdditive());
          } else if (this.optional('>=')) {
            result = new _ast.Binary('>=', result, this.parseAdditive());
          } else {
            return result;
          }
        }
      }
    }, {
      key: 'parseAdditive',
      value: function parseAdditive() {
        var result = this.parseMultiplicative();

        while (true) {
          if (this.optional('+')) {
            result = new _ast.Binary('+', result, this.parseMultiplicative());
          } else if (this.optional('-')) {
            result = new _ast.Binary('-', result, this.parseMultiplicative());
          } else {
            return result;
          }
        }
      }
    }, {
      key: 'parseMultiplicative',
      value: function parseMultiplicative() {
        var result = this.parsePrefix();

        while (true) {
          if (this.optional('*')) {
            result = new _ast.Binary('*', result, this.parsePrefix());
          } else if (this.optional('%')) {
            result = new _ast.Binary('%', result, this.parsePrefix());
          } else if (this.optional('/')) {
            result = new _ast.Binary('/', result, this.parsePrefix());
          } else {
            return result;
          }
        }
      }
    }, {
      key: 'parsePrefix',
      value: function parsePrefix() {
        if (this.optional('+')) {
          return this.parsePrefix();
        } else if (this.optional('-')) {
          return new _ast.Binary('-', new _ast.LiteralPrimitive(0), this.parsePrefix());
        } else if (this.optional('!')) {
          return new _ast.PrefixNot('!', this.parsePrefix());
        } else {
          return this.parseAccessOrCallMember();
        }
      }
    }, {
      key: 'parseAccessOrCallMember',
      value: function parseAccessOrCallMember() {
        var result = this.parsePrimary();

        while (true) {
          if (this.optional('.')) {
            var name = this.peek.text;

            this.advance();

            if (this.optional('(')) {
              var args = this.parseExpressionList(')');
              this.expect(')');
              result = new _ast.CallMember(result, name, args);
            } else {
              result = new _ast.AccessMember(result, name);
            }
          } else if (this.optional('[')) {
            var key = this.parseExpression();
            this.expect(']');
            result = new _ast.AccessKeyed(result, key);
          } else if (this.optional('(')) {
            var args = this.parseExpressionList(')');
            this.expect(')');
            result = new _ast.CallFunction(result, args);
          } else {
            return result;
          }
        }
      }
    }, {
      key: 'parsePrimary',
      value: function parsePrimary() {
        if (this.optional('(')) {
          var result = this.parseExpression();
          this.expect(')');
          return result;
        } else if (this.optional('null') || this.optional('undefined')) {
          return new _ast.LiteralPrimitive(null);
        } else if (this.optional('true')) {
          return new _ast.LiteralPrimitive(true);
        } else if (this.optional('false')) {
          return new _ast.LiteralPrimitive(false);
        } else if (this.optional('[')) {
          var elements = this.parseExpressionList(']');
          this.expect(']');
          return new _ast.LiteralArray(elements);
        } else if (this.peek.text == '{') {
          return this.parseObject();
        } else if (this.peek.key != null) {
          return this.parseAccessOrCallScope();
        } else if (this.peek.value != null) {
          var value = this.peek.value;
          this.advance();
          return isNaN(value) ? new _ast.LiteralString(value) : new _ast.LiteralPrimitive(value);
        } else if (this.index >= this.tokens.length) {
          throw new Error('Unexpected end of expression: ' + this.input);
        } else {
          this.error('Unexpected token ' + this.peek.text);
        }
      }
    }, {
      key: 'parseAccessOrCallScope',
      value: function parseAccessOrCallScope() {
        var name = this.peek.key;

        this.advance();

        if (!this.optional('(')) {
          return new _ast.AccessScope(name);
        }

        var args = this.parseExpressionList(')');
        this.expect(')');
        return new _ast.CallScope(name, args);
      }
    }, {
      key: 'parseObject',
      value: function parseObject() {
        var keys = [],
            values = [];

        this.expect('{');

        if (this.peek.text !== '}') {
          do {
            var value = this.peek.value;
            keys.push(typeof value === 'string' ? value : this.peek.text);

            this.advance();
            this.expect(':');

            values.push(this.parseExpression());
          } while (this.optional(','));
        }

        this.expect('}');

        return new _ast.LiteralObject(keys, values);
      }
    }, {
      key: 'parseExpressionList',
      value: function parseExpressionList(terminator) {
        var result = [];

        if (this.peek.text != terminator) {
          do {
            result.push(this.parseExpression());
          } while (this.optional(','));
        }

        return result;
      }
    }, {
      key: 'optional',
      value: function optional(text) {
        if (this.peek.text === text) {
          this.advance();
          return true;
        }

        return false;
      }
    }, {
      key: 'expect',
      value: function expect(text) {
        if (this.peek.text === text) {
          this.advance();
        } else {
          this.error('Missing expected ' + text);
        }
      }
    }, {
      key: 'advance',
      value: function advance() {
        this.index++;
      }
    }, {
      key: 'error',
      value: function error(message) {
        var location = this.index < this.tokens.length ? 'at column ' + (this.tokens[this.index].index + 1) + ' in' : 'at the end of the expression';

        throw new Error('Parser Error: ' + message + ' ' + location + ' [' + this.input + ']');
      }
    }]);

    return ParserImplementation;
  })();

  exports.ParserImplementation = ParserImplementation;
});