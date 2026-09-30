namespace QuizMaster.Domain.Academic;

public partial class Grade
{
    public static Grade Create(Stage stage, string name, int order, IQuizMasterAction action)
    {
        var grade = new Grade { CreatedById = action.CreatedById, CreatedOn = action.CreatedOn };
        grade.Apply(stage, name, order);
        return grade;
    }

    public void Update(Stage stage, string name, int order, IQuizMasterAction action)
    {
        Apply(stage, name, order);
        (LastModifiedById, LastModifiedOn) = (action.CreatedById, action.CreatedOn);
    }

    private void Apply(Stage stage, string name, int order)
        => (StageId, Name, Order) = (stage.Id, AcademicRules.RequiredName(name), AcademicRules.NonNegativeOrder(order));
}
