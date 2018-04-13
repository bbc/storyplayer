TEST - DO NOT MERGE! 4

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

Developing against a local [Romper](https://github.com/bbc/romper) instance
--------------

You'll need to follow the steps below to test Storyformer against unpublished Romper changes (assuming Yarn is being used for dependency management):

1. SSH into the Storyformer Vagrant box with `vagrant ssh`
1. Navigate to the Romper directory: `cd ~/workspace/romper`
1. Run `yarn link` and check you see the following output:

   ```bash
   [developer@sandbox7 romper]$ yarn link
   yarn link v1.2.1
   success Registered "@bbc/romper".
   info You can now run `yarn link "@bbc/romper"` in the projects where you want to use this module and it will be used instead.
   ```

1. Navigate back to the Storyformer repo: `cd ~/workspace/rd-ux-storyformer`
1. Run `yarn link "@bbc/romper"` and verify the command worked:

   ```bash
   [developer@sandbox7 rd-ux-storyformer]$ yarn link "@bbc/romper"
   yarn link v1.2.1
   success Using linked module for "@bbc/romper".
   ```

1. (Optional) Verify that your `node_modules` is pointing to the correct version of Romper:

       ```bash
       [developer@sandbox7 rd-ux-storyformer]$ ls -l node_modules/@bbc
       total 4
       ... 1 1499 developer 15 Dec  4 11:12 romper -> ../../../romper
       ```

⚠️ You must run `yarn build` in the Romper directory to make local changes available to repositories using the linked
version.

⚠️ The Webpack default setting for symlink resolution when building must be disabled:

```javascript
const config = {
    resolve: {
        extensions: ['.js', '.jsx'],
        symlinks: false, // webpack builds will fail without this line
    },
};
```
