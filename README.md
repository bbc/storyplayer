Romper
======

R&D's Object-based Media Player

How to use
----------

_Coming soon_

How to develop
--------------

* We use [Yarn](https://yarnpkg.com/en/) for dependency management, Mocha as a test runner with Chai for assertions.
  TDD is preferred here. We have an ESLint file which follows our house file, and we prefer to have Facebook Flow
  annotations in place for type checking.
* Run `yarn` to get all your dev dependencies included
* `demo.html` puts a simple player onto a page
* `npm run build` will do a single build of the library
* `npm test` will do a single run of the tests (Mocha with Chai, ESLint and Flow type checking)
* `npm run watch` will do continuously build and test the libraryon change
