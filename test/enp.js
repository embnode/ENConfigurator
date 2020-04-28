describe('Embedded npde protocol test', () => {

    describe('output', () => {

        before(() => {
            console.log("before");
        });

        after(() => {
            console.log("after");
        });

        beforeEach(() => {
            console.log("beforeEach");
        });

        it('dummy test', () => {
            console.log("protocol test");
            var first = 5;
            var second = 5;
            expect(first).to.equal(second);
        });
    });
});
