export default class CustomContextPadProvider {
    static $inject: string[];
    constructor(contextPad:any) {
      contextPad.registerProvider(this);
    }

    getContextPadEntries() {
      return function (entries:any) {
        // console.log(entries);

        return entries;
      };
    }
  }

  CustomContextPadProvider.$inject = ["contextPad"];
