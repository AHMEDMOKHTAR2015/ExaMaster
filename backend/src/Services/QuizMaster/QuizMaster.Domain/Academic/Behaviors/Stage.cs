namespace QuizMaster.Domain.Academic;

public partial class Stage
{
    public static Stage Create(string name, int order, IQuizMasterAction action)
    {
        var stage = new Stage { CreatedById = action.CreatedById, CreatedOn = action.CreatedOn };
        stage.Apply(name, order);
        return stage;
    }

    public void Update(string name, int order, IQuizMasterAction action)
    {
        Apply(name, order);
        (LastModifiedById, LastModifiedOn) = (action.CreatedById, action.CreatedOn);
    }

    private void Apply(string name, int order)
        => (Name, Order) = (AcademicRules.RequiredName(name), AcademicRules.NonNegativeOrder(order));
}
